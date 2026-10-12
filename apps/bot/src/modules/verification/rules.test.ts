import { describe, expect, it } from "vitest";
import { verificationSettingsSchema } from "@aboutselphy/shared/entry";
import { answerMatches, daysUntilOldEnough, normalizeAnswer, oldEnough, shouldKickUnverified, type KickCandidate } from "./rules";

describe("answers", () => {
  it("ignores case, extra spaces and compatibility characters", () => {
    expect(normalizeAnswer("  Hello   WORLD ")).toBe("hello world");
    expect(normalizeAnswer("ＡＢＣ")).toBe("abc");
  });
  it("matches the same answer written differently, and nothing else", () => {
    expect(answerMatches("  Sunflower ", "sunflower")).toBe(true);
    expect(answerMatches("sunflowers", "sunflower")).toBe(false);
    expect(answerMatches("", "sunflower")).toBe(false);
  });
  it("an empty expected answer never matches, not even an empty one", () => {
    expect(answerMatches("", "")).toBe(false);
    expect(answerMatches("   ", "  ")).toBe(false);
  });
});

describe("account age", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  it("no limit with 0 days", () => {
    expect(oldEnough(new Date("2026-11-03T11:59:00Z"), now, 0)).toBe(true);
  });
  it("compares whole days", () => {
    expect(oldEnough(new Date("2026-10-27T12:00:00Z"), now, 7)).toBe(true);
    expect(oldEnough(new Date("2026-10-27T12:00:01Z"), now, 7)).toBe(false);
  });
  it("says how many days are left", () => {
    expect(daysUntilOldEnough(new Date("2026-11-01T12:00:00Z"), now, 7)).toBe(5);
    expect(daysUntilOldEnough(new Date("2026-10-01T12:00:00Z"), now, 7)).toBe(0);
  });
});

describe("shouldKickUnverified", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const enabledAt = new Date("2026-11-01T00:00:00Z");
  const base: KickCandidate = { isBot: false, isStaff: false, hasVerifiedRole: false, otherRoleCount: 0, joinedAt: new Date("2026-11-02T00:00:00Z") };
  it("kicks a member who joined after the gate and waited too long", () => {
    expect(shouldKickUnverified(base, enabledAt, now, 24)).toBe(true);
  });
  it("waits until the time is up", () => {
    expect(shouldKickUnverified({ ...base, joinedAt: new Date("2026-11-03T00:00:00Z") }, enabledAt, now, 24)).toBe(false);
  });
  it("never touches anyone who was already here when the gate was switched on", () => {
    expect(shouldKickUnverified({ ...base, joinedAt: new Date("2026-10-01T00:00:00Z") }, enabledAt, now, 24)).toBe(false);
  });
  it("never touches bots, staff, verified members or members with another role", () => {
    for (const patch of [{ isBot: true }, { isStaff: true }, { hasVerifiedRole: true }, { otherRoleCount: 1 }] as const) expect(shouldKickUnverified({ ...base, ...patch }, enabledAt, now, 24), JSON.stringify(patch)).toBe(false);
  });
  it("is off at 0 hours, without a start time or without a join time", () => {
    expect(shouldKickUnverified(base, enabledAt, now, 0)).toBe(false);
    expect(shouldKickUnverified(base, null, now, 24)).toBe(false);
    expect(shouldKickUnverified({ ...base, joinedAt: null }, enabledAt, now, 24)).toBe(false);
  });
});

describe("settings", () => {
  const ok = { enabled: true, channelId: "123456789012345678", verifiedRoleId: "223456789012345678", unverifiedRoleId: "", panelTitle: "Welcome", panelDescription: "", buttonLabel: "Verify", question: "", answer: "", minAccountAgeDays: 0, kickAfterHours: 0 };
  it("needs a channel and a role to be switched on", () => {
    expect(verificationSettingsSchema.safeParse(ok).success).toBe(true);
    expect(verificationSettingsSchema.safeParse({ ...ok, channelId: "" }).success).toBe(false);
    expect(verificationSettingsSchema.safeParse({ ...ok, verifiedRoleId: "" }).success).toBe(false);
    expect(verificationSettingsSchema.safeParse({ ...ok, enabled: false, channelId: "", verifiedRoleId: "" }).success).toBe(true);
  });
  it("a question needs an answer, and the two roles must differ", () => {
    expect(verificationSettingsSchema.safeParse({ ...ok, question: "Colour of the sky?" }).success).toBe(false);
    expect(verificationSettingsSchema.safeParse({ ...ok, question: "Colour of the sky?", answer: "blue" }).success).toBe(true);
    expect(verificationSettingsSchema.safeParse({ ...ok, unverifiedRoleId: ok.verifiedRoleId }).success).toBe(false);
  });
});
