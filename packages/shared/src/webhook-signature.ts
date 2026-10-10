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
