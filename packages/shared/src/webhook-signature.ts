import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SIGNATURE_TOLERANCE_SECONDS } from "./webhooks";

// Signing for webhooks, both directions: HMAC-SHA256 over "<unix timestamp>.<raw body>", sent as
// "sha256=<hex>" together with the timestamp. The body is signed exactly as received (never a
// re-serialised copy), the compare is constant time and a timestamp outside the tolerance is refused,
// so a captured request can't be replayed later. Node only: import it from
// "@aboutselphy/shared/webhook-signature", never from the package index.

export const SIGNATURE_PREFIX = "sha256=";

export const newSecret = (): string => randomBytes(32).toString("hex");

export function sign(secret: string, timestamp: string, rawBody: string): string {
  return SIGNATURE_PREFIX + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/** Does `signature` match this secret, timestamp and body? */
export function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string): boolean {
  const expected = Buffer.from(sign(secret, timestamp, rawBody));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Is the timestamp (unix seconds, as text) within the tolerance of `nowMs`? Anything that isn't a plain integer is refused. */
export function isFresh(timestamp: string, nowMs: number): boolean {
  if (!/^\d{9,11}$/.test(timestamp)) return false;
  return Math.abs(nowMs / 1000 - Number(timestamp)) <= SIGNATURE_TOLERANCE_SECONDS;
}

/** Constant-time equality for two secrets/tokens of any length (unequal lengths are simply unequal). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** GitHub's `X-Hub-Signature-256`: "sha256=" + the HMAC-SHA256 of the raw body, keyed with the endpoint's secret. No timestamp (GitHub sends none). */
export function verifyGithubSignature(secret: string, rawBody: string, header: string): boolean {
  const expected = SIGNATURE_PREFIX + createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(header, expected);
}

/**
 * Stripe's `Stripe-Signature`: "t=<unix seconds>,v1=<hex>[,v1=<hex>...]", where each v1 is the HMAC-SHA256 of "<t>.<raw body>" keyed with the
 * endpoint's signing secret. The timestamp must be fresh (replay protection) and any one v1 may match (Stripe sends two while a secret rotates).
 */
export function verifyStripeSignature(secret: string, rawBody: string, header: string, nowMs: number): boolean {
  const parts = header.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2) ?? "";
  if (!isFresh(t, nowMs)) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return parts.some((p) => p.startsWith("v1=") && safeEqual(p.slice(3), expected));
}
