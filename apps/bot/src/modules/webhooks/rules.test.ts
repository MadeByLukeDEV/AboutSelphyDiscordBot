import { describe, expect, it } from "vitest";
import { endpointInput, inboundPayload, isDiscordWebhookUrl, isPublicHttpsUrl, outboundInput } from "@aboutselphy/shared/webhooks";
import { isFresh, newSecret, sign, verifySignature } from "@aboutselphy/shared/webhook-signature";
import { buildRelayEmbed, describeEvent } from "./rules";

describe("signatures", () => {
  const secret = newSecret();
  const ts = "1790000000";
  const body = '{"content":"hi"}';

  it("verify the exact body and secret, nothing else", () => {
    const sig = sign(secret, ts, body);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifySignature(secret, ts, body, sig)).toBe(true);
    expect(verifySignature(secret, ts, body + " ", sig)).toBe(false);
    expect(verifySignature(secret, "1790000001", body, sig)).toBe(false);
    expect(verifySignature(newSecret(), ts, body, sig)).toBe(false);
    expect(verifySignature(secret, ts, body, "sha256=00")).toBe(false);
    expect(verifySignature(secret, ts, body, "")).toBe(false);
  });

  it("generate long random secrets", () => {
    expect(newSecret()).toMatch(/^[0-9a-f]{64}$/);
    expect(newSecret()).not.toBe(newSecret());
  });

  it("refuse stale, future and malformed timestamps", () => {
    const now = 1_790_000_000_000;
    expect(isFresh("1790000000", now)).toBe(true);
    expect(isFresh("1789999800", now)).toBe(true);
    expect(isFresh("1789999000", now)).toBe(false);
    expect(isFresh("1790001000", now)).toBe(false);
    for (const bad of ["", "abc", "17900.5", "-1790000000", "1790000000 ", "99999999999999"]) expect(isFresh(bad, now), bad).toBe(false);
  });
});

describe("addresses", () => {
  it("accepts only real Discord webhook addresses", () => {
    expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/123456789012345678/abcDEF_-abcDEF_-abcDEF_-abc")).toBe(true);
    for (const bad of ["http://discord.com/api/webhooks/123456789012345678/abc", "https://evil.example/api/webhooks/123456789012345678/abcDEF_-abcDEF_-abcDEF_-abc", "https://discord.com.evil.example/api/webhooks/1/2", "https://discord.com/api/webhooks/12/abc"]) expect(isDiscordWebhookUrl(bad), bad).toBe(false);
  });

  it("accepts ordinary https hosts and refuses local, internal and IP-literal ones", () => {
    for (const ok of ["https://hooks.example.com/in", "https://example.org:8443/x?y=1"]) expect(isPublicHttpsUrl(ok), ok).toBe(true);
    for (const bad of ["http://hooks.example.com", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.1/x", "https://[::1]/x", "https://printer.local/x", "https://svc.internal/x", "https://user:pw@example.com/x", "https://example.com:22/x", "https://example/x", "https://example.com/a b", "ftp://example.com"]) expect(isPublicHttpsUrl(bad), bad).toBe(false);
  });
});

describe("inputs", () => {
  it("the inbound payload needs text, allows only known fields and an https link", () => {
    expect(inboundPayload.safeParse({ content: "hi" }).success).toBe(true);
    expect(inboundPayload.safeParse({ title: "t", url: "https://example.com/x", color: 255 }).success).toBe(true);
    expect(inboundPayload.safeParse({}).success).toBe(false);
    expect(inboundPayload.safeParse({ content: "hi", embeds: [] }).success).toBe(false);
    expect(inboundPayload.safeParse({ title: "t", url: "javascript:alert(1)" }).success).toBe(false);
    expect(inboundPayload.safeParse({ content: "x".repeat(2001) }).success).toBe(false);
  });

  it("endpoint and outbound inputs are validated", () => {
    expect(endpointInput.safeParse({ name: "GitHub", channelId: "123456789012345678", enabled: true }).success).toBe(true);
    expect(endpointInput.safeParse({ name: " ", channelId: "123456789012345678", enabled: true }).success).toBe(false);
    const base = { name: "n", kind: "generic", url: "https://hooks.example.com/in", events: ["mod.case"], enabled: true };
    expect(outboundInput.safeParse(base).success).toBe(true);
    expect(outboundInput.safeParse({ ...base, url: "https://localhost/x" }).success).toBe(false);
    expect(outboundInput.safeParse({ ...base, kind: "discord" }).success).toBe(false);
    expect(outboundInput.safeParse({ ...base, events: [] }).success).toBe(false);
    expect(outboundInput.safeParse({ ...base, events: ["nope"] }).success).toBe(false);
    expect(outboundInput.safeParse({ ...base, url: "" }).success).toBe(false);
    expect(outboundInput.safeParse({ ...base, url: "", id: "abc" }).success).toBe(true);
  });
});

describe("messages", () => {
  it("relay embeds escape everything, ignore bad links and ping nobody", () => {
    const m = buildRelayEmbed({ source: "Git*Hub", title: "Build **failed** <@&999999999999999999>", content: "line1\n[click](https://x.test) @everyone", url: "javascript:alert(1)", color: 255 });
    const json = JSON.stringify(m.embeds[0]!.toJSON());
    expect(json).not.toMatch(/(?<!\\)<@&99/);
    expect(json).not.toContain("javascript:");
    expect(json).toContain("Git\\\\*Hub");
    expect(m.allowedMentions).toEqual({ parse: [] });
    expect(buildRelayEmbed({ source: "s", title: "t", url: "https://example.com/a" }).embeds[0]!.toJSON().url).toBe("https://example.com/a");
  });

  it("describes events without letting names or reasons through unescaped", () => {
    const d = describeEvent("mod.case", { caseNumber: 7, type: "ban", targetId: "111111111111111111", targetName: "Bob **x**", moderatorName: "Mod", reason: "spam <@&99>", durationSeconds: null });
    expect(d.title).toBe("Case #7 · ban");
    expect(d.description).toContain("Bob \\*\\*x\\*\\*");
    expect(d.description).not.toMatch(/(?<!\\)<@&/);
    expect(describeEvent("test", {}).title).toBe("Test event");
  });
});
