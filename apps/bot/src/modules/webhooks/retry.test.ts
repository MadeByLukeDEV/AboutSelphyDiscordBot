import { describe, expect, it } from "vitest";
import { ENDPOINT_PROVIDERS, endpointInput } from "@aboutselphy/shared/webhooks";
import { githubPayload, kofiPayload, stripePayload } from "@aboutselphy/shared/webhook-presets";
import { safeEqual, verifyGithubSignature, verifyStripeSignature } from "@aboutselphy/shared/webhook-signature";
import { createHmac } from "node:crypto";
import { AUTO_DISABLE_AFTER, isRetryable, shouldAutoDisable } from "./rules";

describe("retries and auto-disable", () => {
  it("retries what might work next time", () => {
    for (const s of ["timeout", "error", "http 500", "http 502", "http 503", "http 429", "http 408"]) expect(isRetryable(s), s).toBe(true);
  });
  it("does not retry what will not", () => {
    for (const s of ["ok", "blocked", "no key", "key mismatch", "http 400", "http 401", "http 404", "http 410", "http 301", "weird"]) expect(isRetryable(s), s).toBe(false);
  });
  it("switches off after ten failures in a row", () => {
    expect(shouldAutoDisable(AUTO_DISABLE_AFTER - 1)).toBe(false);
    expect(shouldAutoDisable(AUTO_DISABLE_AFTER)).toBe(true);
  });
});

describe("endpoint input", () => {
  const base = { name: "n", channelId: "123456789012345678", enabled: true };
  it("defaults to the generic provider", () => {
    const r = endpointInput.safeParse(base);
    expect(r.success && r.data.provider).toBe("generic");
    expect(ENDPOINT_PROVIDERS).toContain("kofi");
  });
  it("needs Ko-fi's token for a new Ko-fi endpoint, but not when editing", () => {
    expect(endpointInput.safeParse({ ...base, provider: "kofi" }).success).toBe(false);
    expect(endpointInput.safeParse({ ...base, provider: "kofi", secret: "short" }).success).toBe(false);
    expect(endpointInput.safeParse({ ...base, provider: "kofi", secret: "has space in it" }).success).toBe(false);
    expect(endpointInput.safeParse({ ...base, provider: "kofi", secret: "12345678-aaaa-bbbb" }).success).toBe(true);
    expect(endpointInput.safeParse({ ...base, id: "abc", provider: "kofi" }).success).toBe(true);
  });
  it("refuses an unknown provider", () => {
    expect(endpointInput.safeParse({ ...base, provider: "stripe" }).success).toBe(false);
  });
});

describe("signatures", () => {
  const body = '{"zen":"Keep it logically awesome."}';
  const good = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  it("accepts GitHub's signature and nothing else", () => {
    expect(verifyGithubSignature("s3cret", body, good)).toBe(true);
    expect(verifyGithubSignature("other", body, good)).toBe(false);
    expect(verifyGithubSignature("s3cret", body + " ", good)).toBe(false);
    expect(verifyGithubSignature("s3cret", body, good.replace("sha256=", "sha1="))).toBe(false);
    expect(verifyGithubSignature("s3cret", body, "")).toBe(false);
  });
  it("compares tokens of different lengths without throwing", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
  });
});

describe("GitHub presets", () => {
  const repo = { name: "bot", html_url: "https://github.com/me/bot" };
  it("turns a push into a commit list", () => {
    const p = githubPayload("push", { ref: "refs/heads/main", compare: "https://github.com/me/bot/compare/a...b", repository: repo, commits: [{ id: "abcdef1234567", message: "Fix **it**\nlong body", author: { name: "Ann" } }] });
    expect(p?.title).toBe("[bot:main] 1 new commit");
    expect(p?.content).toContain("`abcdef1` Fix **it** - Ann");
    expect(p?.url).toBe("https://github.com/me/bot/compare/a...b");
  });
  it("never links anywhere but github.com", () => {
    const p = githubPayload("issues", { action: "opened", repository: repo, sender: { login: "x" }, issue: { number: 3, title: "Hi", html_url: "https://evil.example/x" } });
    expect(p?.title).toBe("[bot] Issue #3 opened: Hi");
    expect(p?.url).toBeUndefined();
  });
  it("tells merged from closed pull requests", () => {
    const pr = (merged: boolean) => githubPayload("pull_request", { action: "closed", repository: repo, sender: { login: "x" }, pull_request: { number: 7, title: "T", merged, html_url: "https://github.com/me/bot/pull/7" } });
    expect(pr(true)?.title).toContain("merged");
    expect(pr(false)?.title).toContain("closed");
  });
  it("ignores events and actions it does not post, and survives garbage", () => {
    expect(githubPayload("fork", {})).toBeNull();
    expect(githubPayload("issues", { action: "labeled" })).toBeNull();
    expect(githubPayload("push", { ref: "refs/heads/x", deleted: true })).toBeNull();
    expect(githubPayload("push", { commits: [] })).toBeNull();
    expect(githubPayload("push", "nonsense")).toBeNull();
    expect(githubPayload("ping", null)?.title).toBe("GitHub webhook connected");
  });
});

describe("Ko-fi preset", () => {
  const donation = { verification_token: "tok-1234", message_id: "m-1", type: "Donation", is_public: true, from_name: "Fan", message: "Thanks!", amount: "5.00", currency: "EUR", url: "https://ko-fi.com/Home/CoffeeShop?txid=1" };
  it("makes a message from a public donation", () => {
    const k = kofiPayload(donation);
    expect(k?.payload.title).toBe("☕ Fan donated · 5.00 EUR");
    expect(k?.payload.content).toBe("Thanks!");
    expect(k?.payload.url).toBe(donation.url);
    expect(k?.token).toBe("tok-1234");
    expect(k?.messageId).toBe("m-1");
  });
  it("keeps a private supporter anonymous", () => {
    const k = kofiPayload({ ...donation, is_public: false });
    expect(k?.payload.title).toBe("☕ Someone donated · 5.00 EUR");
    expect(k?.payload.content ?? "").toBe("");
  });
  it("needs a token and a message id, and only links Ko-fi", () => {
    expect(kofiPayload({ ...donation, verification_token: "" })).toBeNull();
    expect(kofiPayload({ ...donation, message_id: "" })).toBeNull();
    expect(kofiPayload({ ...donation, url: "https://evil.example/" })?.payload.url).toBeUndefined();
  });
});

describe("Stripe", () => {
  const secret = "whsec_test_secret";
  const now = 1_800_000_000_000;
  const t = String(Math.floor(now / 1000));
  const body = JSON.stringify({ id: "evt_1ABCdef23456", type: "checkout.session.completed", data: { object: { amount_total: 1250, currency: "eur", mode: "payment", customer_email: "secret@example.com" } } });
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

  it("verifies the signature over the raw body with a fresh timestamp", () => {
    expect(verifyStripeSignature(secret, body, `t=${t},v1=${v1}`, now)).toBe(true);
    expect(verifyStripeSignature(secret, body, `t=${t},v1=${"0".repeat(64)},v1=${v1}`, now)).toBe(true);
    expect(verifyStripeSignature("other", body, `t=${t},v1=${v1}`, now)).toBe(false);
    expect(verifyStripeSignature(secret, body + " ", `t=${t},v1=${v1}`, now)).toBe(false);
    expect(verifyStripeSignature(secret, body, `t=${t},v1=bad`, now)).toBe(false);
    expect(verifyStripeSignature(secret, body, `v1=${v1}`, now)).toBe(false);
    expect(verifyStripeSignature(secret, body, "", now)).toBe(false);
  });
  it("refuses an old timestamp even with a valid signature", () => {
    const old = String(Math.floor(now / 1000) - 3600);
    const sig = createHmac("sha256", secret).update(`${old}.${body}`).digest("hex");
    expect(verifyStripeSignature(secret, body, `t=${old},v1=${sig}`, now)).toBe(false);
  });
  it("shows amounts only", () => {
    const m = stripePayload(JSON.parse(body))!;
    expect(m.eventId).toBe("evt_1ABCdef23456");
    expect(m.payload.title).toBe("💳 New payment · 12.50 EUR");
    expect(JSON.stringify(m.payload)).not.toContain("secret@example.com");
    expect(m.payload.url).toBeUndefined();
  });
  it("handles zero-decimal currencies, refunds and unknown events", () => {
    expect(stripePayload({ id: "evt_1ABCdef23456", type: "charge.refunded", data: { object: { amount_refunded: 500, currency: "jpy" } } })!.payload.title).toBe("↩️ Refund · 500 JPY");
    expect(stripePayload({ id: "evt_1ABCdef23456", type: "customer.created", data: { object: {} } })).toBeNull();
    expect(stripePayload({ id: "bad", type: "charge.refunded", data: { object: { amount_refunded: 1, currency: "eur" } } })).toBeNull();
    expect(stripePayload({ id: "evt_1ABCdef23456", type: "payment_intent.succeeded", data: { object: { amount: 100, currency: "eur", invoice: "in_1" } } })).toBeNull();
  });
  it("stripe endpoints paste their secret", () => {
    expect(endpointInput.safeParse({ name: "n", channelId: "123456789012345678", enabled: true, provider: "stripe" }).success).toBe(false);
    expect(endpointInput.safeParse({ name: "n", channelId: "123456789012345678", enabled: true, provider: "stripe", secret: "whsec_abcdefgh" }).success).toBe(true);
  });
});
