import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
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
    const resolver = opts.lookup ?? dnsLookup;
    let blocked = false;
    const req = request(
      target,
      {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "user-agent": "AboutSelphy-Bot-Webhook/1", ...headers },
        timeout: opts.timeoutMs ?? 5000,
        // The connection uses exactly the address validated here.
        lookup: (hostname, options, callback) => {
          resolver(hostname, { ...options, all: false }, (err, address, family) => {
            if (err) return callback(err, "", 4);
            if (isBlockedAddress(address as string)) {
              blocked = true;
              return callback(new Error("blocked address"), "", 4);
            }
            callback(null, address as string, family as number);
          });
        },
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
