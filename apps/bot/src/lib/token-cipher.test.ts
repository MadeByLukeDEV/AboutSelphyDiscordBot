import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@aboutselphy/shared/token-cipher";

const key = randomBytes(32).toString("hex");

describe("token cipher", () => {
  it("round-trips and never stores the plain text", () => {
    const stored = encryptToken("refresh-secret", "twitch-bot-refresh-token", key);
    expect(stored).not.toContain("refresh-secret");
    expect(decryptToken(stored, "twitch-bot-refresh-token", key)).toBe("refresh-secret");
  });

  it("uses a fresh iv every time", () => {
    expect(encryptToken("x", "p", key)).not.toBe(encryptToken("x", "p", key));
  });

  it("refuses another purpose, another key and tampering", () => {
    const stored = encryptToken("secret", "purpose-a", key);
    expect(() => decryptToken(stored, "purpose-b", key)).toThrow();
    expect(() => decryptToken(stored, "purpose-a", randomBytes(32).toString("hex"))).toThrow();
    const [v, iv, tag, ct] = stored.split(".");
    expect(() => decryptToken([v, iv, tag, ct!.slice(0, -2) + "AA"].join("."), "purpose-a", key)).toThrow();
    expect(() => decryptToken("garbage", "purpose-a", key)).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    expect(() => encryptToken("x", "p", "abcd")).toThrow(/32 bytes/);
  });
});
