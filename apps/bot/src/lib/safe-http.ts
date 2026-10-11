import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request } from "node:https";

// Outgoing HTTPS calls to addresses staff typed in. A name can point anywhere, so the address the
// connection really uses is checked at connect time (not just when the webhook was saved, which would
// leave DNS rebinding open): loopback, private, link-local (cloud metadata), carrier-grade NAT,
// multicast and reserved ranges are refused, for IPv4 and IPv6 (including IPv4-mapped). Redirects
// are not followed and the answer's body is never read.

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

/** Is this an address a webhook must never be sent to? Unparseable input counts as blocked. */
export function isBlockedAddress(ip: string): boolean {
  const v4 = ipv4Parts(ip);
  if (v4) {
    const [a, b, c] = v4 as [number, number, number, number];
    return (
      a === 0 || // "this" network
      a === 10 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      a === 127 ||
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast and reserved
    );
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isBlockedAddress(mapped[1]!);
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1]!, 16);
      const lo = parseInt(mappedHex[2]!, 16);
      return isBlockedAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith("ff") || lower.startsWith("64:ff9b:") || lower.startsWith("2001:db8");
  }
  return true;
}

/**
 * A DNS lookup for http.request that refuses private addresses. Node's connection logic asks for every
 * address of a name (`options.all`), so this answers in whichever shape it was asked for. Every address
 * is checked, and one blocked address blocks the name (nothing is ever connected to a mix).
 */
function checkedLookup(resolver: typeof dnsLookup, onBlocked: () => void) {
  return (hostname: string, options: { all?: boolean; family?: number; hints?: number }, callback: (...args: unknown[]) => void): void => {
    const wantAll = options.all === true;
    resolver(hostname, { ...options, all: true }, (err, addresses) => {
      const fail = (e: Error) => (wantAll ? callback(e, []) : callback(e, "", 4));
      if (err) return fail(err);
      const list = addresses as unknown as LookupAddress[];
      if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
        onBlocked();
        return fail(new Error("blocked address"));
      }
      if (wantAll) callback(null, list);
      else callback(null, list[0]!.address, list[0]!.family);
    });
  };
}

/** A host typed as a raw IP address skips DNS (so the connect-time lookup never runs): check it directly. */
function literalIsBlocked(target: URL): boolean {
  const host = target.hostname.replace(/^\[|\]$/g, "");
  return isIP(host) !== 0 && isBlockedAddress(host);
}

export type PostResult = { ok: true; status: number } | { ok: false; reason: "blocked" | "timeout" | "error" };

/** POSTs a JSON body. `lookup` is injectable for tests. */
export function postJson(url: string, body: string, headers: Record<string, string>, opts: { timeoutMs?: number; lookup?: typeof dnsLookup } = {}): Promise<PostResult> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return resolve({ ok: false, reason: "error" });
    }
    if (target.protocol !== "https:" || target.username || target.password) return resolve({ ok: false, reason: "blocked" });
    if (literalIsBlocked(target)) return resolve({ ok: false, reason: "blocked" });
    const resolver = opts.lookup ?? dnsLookup;
    let blocked = false;
    const req = request(
      target,
      {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "user-agent": "AboutSelphy-Bot-Webhook/1", ...headers },
        timeout: opts.timeoutMs ?? 5000,
        // The connection uses exactly the address validated here.
        lookup: checkedLookup(resolver, () => {
          blocked = true;
        }) as never,
      },
      (res) => {
        res.resume(); // the answer is never read
        resolve({ ok: true, status: res.statusCode ?? 0 });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, reason: "timeout" });
    });
    req.on("error", () => resolve({ ok: false, reason: blocked ? "blocked" : "error" }));
    req.end(body);
  });
}

export type GetResult = { ok: true; status: number; body: string } | { ok: false; reason: "blocked" | "timeout" | "error" | "too-large"; /** For "error": the error code (ENOTFOUND = the name doesn't exist, ECONNREFUSED = nothing listens there, ECONNRESET, a certificate code ...). Why it was blocked: "login in url", "http" (plain http needs the host on the internal list), "scheme" or "address" (the name resolved to a private address). */ detail?: string };

/**
 * GETs a text document (a feed). A host in `internalHosts` (exact name match: a feed bridge on the
 * private network) may be http or https and is connected to normally; every other address must be
 * https and passes the same connect-time address check as postJson. Redirects are not followed (the
 * status is returned) and at most `maxBytes` of the body are read.
 */
export function getText(url: string, opts: { internalHosts?: readonly string[]; maxBytes?: number; timeoutMs?: number; lookup?: typeof dnsLookup } = {}): Promise<GetResult> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return resolve({ ok: false, reason: "error" });
    }
    if (target.username || target.password) return resolve({ ok: false, reason: "blocked", detail: "login in url" });
    const internal = (opts.internalHosts ?? []).includes(target.hostname.toLowerCase());
    if (!internal && target.protocol !== "https:") return resolve({ ok: false, reason: "blocked", detail: target.protocol === "http:" ? "http" : "scheme" });
    if (target.protocol !== "https:" && target.protocol !== "http:") return resolve({ ok: false, reason: "blocked", detail: "scheme" });
    if (!internal && literalIsBlocked(target)) return resolve({ ok: false, reason: "blocked", detail: "address" });
    const maxBytes = opts.maxBytes ?? 1_000_000;
    const resolver = opts.lookup ?? dnsLookup;
    let blocked = false;
    const send = target.protocol === "https:" ? request : httpRequest;
    const req = send(
      target,
      {
        method: "GET",
        headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5", "user-agent": "AboutSelphy-Bot-Feeds/1" },
        timeout: opts.timeoutMs ?? 10_000,
        ...(internal
          ? {}
          : {
              lookup: checkedLookup(resolver, () => {
                blocked = true;
              }) as never,
            }),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            req.destroy();
            return resolve({ ok: false, reason: "too-large" });
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ ok: true, status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", () => resolve({ ok: false, reason: "error" }));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, reason: "timeout" });
    });
    req.on("error", (err: NodeJS.ErrnoException) => resolve(blocked ? { ok: false, reason: "blocked", detail: "address" } : { ok: false, reason: "error", detail: typeof err.code === "string" ? err.code.slice(0, 16) : undefined }));
    req.end();
  });
}
