import "server-only";
import { decryptToken } from "@aboutselphy/shared/token-cipher";
import { githubPayload, kofiPayload } from "@aboutselphy/shared/webhook-presets";
import { isFresh, safeEqual, verifyGithubSignature, verifySignature } from "@aboutselphy/shared/webhook-signature";
import { inboundPayload, MAX_GITHUB_BODY, MAX_INBOUND_BODY, type InboundPayload } from "@aboutselphy/shared/webhooks";
import { env } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { relayWebhookViaBot } from "@/modules/bot-api";
import { ENDPOINT_SECRET_PURPOSE } from "./service";
import { countUse, findEndpoint } from "./repository";

// The public endpoint behind /api/webhooks/in/<id>. Everything here is untrusted input, so the order
// matters: size, the per-address limit, the endpoint, then the proof that the sender knows the secret
// (our own HMAC over the raw body with a fresh timestamp, GitHub's HMAC, or Ko-fi's token, depending on the
// endpoint's provider), then replay and rate limits, and only then is the body parsed (strictly) and handed
// to the bot. Every authentication failure looks the same from outside (401), so an id can't be probed.
// Only the bot talks to Discord.

export type ReceiveResult = { status: 200 | 400 | 401 | 413 | 429 | 502 | 503; body: { ok: boolean; error?: string } };

export type ReceiveInput = {
  id: string;
  rawBody: string;
  contentLength: number | null;
  /** Our own scheme. */
  timestamp: string | null;
  signature: string | null;
  /** GitHub: X-Hub-Signature-256, X-GitHub-Event, X-GitHub-Delivery. */
  githubSignature: string | null;
  githubEvent: string | null;
  deliveryId: string | null;
  ip: string;
};

const reply = (status: ReceiveResult["status"], error?: string): ReceiveResult => ({ status, body: error ? { ok: false, error } : { ok: true } });
const unauthorized = () => reply(401, "unauthorized");

// Small in-memory windows (the dashboard is one process; a restart only forgets the last few minutes).
const seen = new Map<string, number>(); // replay key -> expires at
const hits = new Map<string, number[]>(); // rate key -> recent timestamps

function limited(key: string, max: number, windowMs: number, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return false;
}

type Proven = { replayKey: string; payload: () => InboundPayload | "invalid" | "ignored" };

/** Checks the proof for the endpoint's provider. Null = not authenticated. */
function authenticate(provider: string, secret: string, input: ReceiveInput, now: number): Proven | null {
  if (provider === "github") {
    if (!input.githubSignature || !verifyGithubSignature(secret, input.rawBody, input.githubSignature)) return null;
    if (!input.deliveryId || !/^[A-Za-z0-9-]{8,100}$/.test(input.deliveryId)) return null;
    const event = (input.githubEvent ?? "").slice(0, 40);
    return {
      replayKey: input.deliveryId,
      payload: () => {
        let json: unknown;
        try {
          json = JSON.parse(input.rawBody);
        } catch {
          return "invalid";
        }
        return githubPayload(event, json) ?? "ignored";
      },
    };
  }

  if (provider === "kofi") {
    let json: unknown;
    try {
      const data = new URLSearchParams(input.rawBody).get("data");
      if (!data) return null;
      json = JSON.parse(data);
    } catch {
      return null;
    }
    const message = kofiPayload(json);
    // Ko-fi proves itself with the verification token inside the data: a constant-time compare.
    if (!message || !safeEqual(message.token, secret)) return null;
    return { replayKey: message.messageId, payload: () => message.payload };
  }

  // generic: our own HMAC over "<timestamp>.<raw body>"
  if (!input.timestamp || !input.signature || !isFresh(input.timestamp, now)) return null;
  if (!verifySignature(secret, input.timestamp, input.rawBody, input.signature)) return null;
  return {
    replayKey: input.signature,
    payload: () => {
      let json: unknown;
      try {
        json = JSON.parse(input.rawBody);
      } catch {
        return "invalid";
      }
      const parsed = inboundPayload.safeParse(json);
      return parsed.success ? parsed.data : "invalid";
    },
  };
}

export async function receiveWebhook(input: ReceiveInput, now = Date.now()): Promise<ReceiveResult> {
  if (!/^[a-z0-9]{20,40}$/.test(input.id)) return unauthorized();
  if ((input.contentLength !== null && input.contentLength > MAX_GITHUB_BODY) || Buffer.byteLength(input.rawBody) > MAX_GITHUB_BODY) return reply(413, "too large");
  // Per address, before any database or crypto work.
  if (limited(`ip:${input.ip}`, 120, 60_000, now)) return reply(429, "slow down");

  const key = env().TOKEN_ENCRYPTION_KEY;
  if (!key) return reply(503, "not configured");

  let endpoint;
  try {
    endpoint = await findEndpoint(input.id);
  } catch (error) {
    console.error("[webhooks] endpoint lookup failed", errorInfo(error));
    return reply(503, "unavailable");
  }
  if (!endpoint || !endpoint.enabled) return unauthorized();
  let secret: string;
  try {
    secret = decryptToken(endpoint.secretEnc, ENDPOINT_SECRET_PURPOSE, key);
  } catch {
    return unauthorized();
  }
  const proven = authenticate(endpoint.provider, secret, input, now);
  if (!proven) return unauthorized();

  // Authenticated from here on. Only GitHub endpoints may send more than the small limit.
  if (endpoint.provider !== "github" && ((input.contentLength !== null && input.contentLength > MAX_INBOUND_BODY) || Buffer.byteLength(input.rawBody) > MAX_INBOUND_BODY)) return reply(413, "too large");
  for (const [k, expires] of seen) if (expires < now) seen.delete(k);
  const replayKey = `${endpoint.id}:${proven.replayKey}`;
  if (seen.has(replayKey)) return unauthorized(); // a replay looks like any other bad request
  seen.set(replayKey, now + 600_000);
  if (limited(`endpoint:${endpoint.id}`, 30, 60_000, now)) return reply(429, "slow down");

  const payload = proven.payload();
  if (payload === "invalid") return reply(400, "invalid");
  if (payload === "ignored") return reply(200); // a real delivery for an event we don't post (GitHub sends many)

  const status = await relayWebhookViaBot({ channelId: endpoint.channelId, source: endpoint.name, ...payload });
  if (status !== "done") return reply(502, status === null ? "bot unavailable" : "could not post");
  await countUse(endpoint.id).catch(() => undefined);
  return reply(200);
}
