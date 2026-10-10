import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for secrets stored in the database (the Twitch refresh token).
// Same format as Main's token-cipher: "v1.<iv>.<auth tag>.<ciphertext>", each
// part base64url. `purpose` is bound as additional authenticated data, so a
// ciphertext can't be moved to another column or use and still decrypt.
// Node only: import it from "@aboutselphy/shared/token-cipher", never from the
// package index (which client components may reach).

const VERSION = "v1";

function keyFrom(hex: string): Buffer {
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes as 64 hex characters");
  return key;
}

export function encryptToken(plain: string, purpose: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(keyHex), iv);
  cipher.setAAD(Buffer.from(purpose));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/** The plain token, or throws if it was tampered with, the purpose differs or the key changed. */
export function decryptToken(stored: string, purpose: string, keyHex: string): string {
  const [version, iv, tag, ciphertext] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Unknown encrypted token format");
  // authTagLength pins the tag to 16 bytes: Node otherwise accepts a truncated tag.
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(keyHex), Buffer.from(iv, "base64url"), { authTagLength: 16 });
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
