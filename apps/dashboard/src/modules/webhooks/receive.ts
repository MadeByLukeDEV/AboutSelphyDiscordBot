import "server-only";
import { decryptToken } from "@aboutselphy/shared/token-cipher";
import { isFresh, verifySignature } from "@aboutselphy/shared/webhook-signature";
import { inboundPayload, MAX_INBOUND_BODY } from "@aboutselphy/shared/webhooks";
import { env } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { relayWebhookViaBot } from "@/modules/bot-api";
import { ENDPOINT_SECRET_PURPOSE } from "./service";
import { countUse, findEndpoint } from "./repository";

// The public endpoint behind /api/webhooks/in/<id>. Everything here is untrusted input, so the order
// matters: size first, then the signature over the raw body, then the timestamp window, then replay and
// rate limits, and only then is the body parsed (strictly) and handed to the bot. Every authentication
// failure looks the same from outside (401), so an id can't be probed. Only the bot talks to Discord.

export type ReceiveResult = { status: 200 | 400 | 401 | 413 | 429 | 502 | 503; body: { ok: boolean; error?: string } };

const reply = (status: ReceiveResult["status"], error?: string): ReceiveResult => ({ status, body: error ? { ok: false, error } : { ok: true } });

// Small in-memory windows (the dashboard is one process; a restart only forgets the last few minutes).
const seen = new Map<string, number>(); // signature -> expires at
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

export async function receiveWebhook(input: { id: string; rawBody: string; contentLength: number | null; timestamp: string | null; signature: string | null; ip: string }, now = Date.now()): Promise<ReceiveResult> {
  if (!/^[a-z0-9]{20,40}$/.test(input.id)) return reply(401, "unauthorized");
  if ((input.contentLength !== null && input.contentLength > MAX_INBOUND_BODY) || Buffer.byteLength(input.rawBody) > MAX_INBOUND_BODY) return reply(413, "too large");
  // Per address, before any database or crypto work.
  if (limited(`ip:${input.ip}`, 120, 60_000, now)) return reply(429, "slow down");

  const key = env().TOKEN_ENCRYPTION_KEY;
  if (!key) return reply(503, "not configured");
  if (!input.timestamp || !input.signature || !isFresh(input.timestamp, now)) return reply(401, "unauthorized");

  let endpoint;
  try {
    endpoint = await findEndpoint(input.id);
  } catch (error) {
    console.error("[webhooks] endpoint lookup failed", errorInfo(error));
    return reply(503, "unavailable");
  }
  if (!endpoint || !endpoint.enabled) return reply(401, "unauthorized");
  let secret: string;
  try {
    secret = decryptToken(endpoint.secretEnc, ENDPOINT_SECRET_PURPOSE, key);
  } catch {
    return reply(401, "unauthorized");
  }
  if (!verifySignature(secret, input.timestamp, input.rawBody, input.signature)) return reply(401, "unauthorized");

  // Authenticated from here on.
  for (const [sig, expires] of seen) if (expires < now) seen.delete(sig);
  if (seen.has(input.signature)) return reply(401, "unauthorized"); // a replay looks like any other bad request
  seen.set(input.signature, now + 600_000);
  if (limited(`endpoint:${endpoint.id}`, 30, 60_000, now)) return reply(429, "slow down");

  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    return reply(400, "invalid");
  }
  const payload = inboundPayload.safeParse(json);
  if (!payload.success) return reply(400, "invalid");

  const status = await relayWebhookViaBot({ channelId: endpoint.channelId, source: endpoint.name, ...payload.data });
  if (status !== "done") return reply(502, status === null ? "bot unavailable" : "could not post");
  await countUse(endpoint.id).catch(() => undefined);
  return reply(200);
}
