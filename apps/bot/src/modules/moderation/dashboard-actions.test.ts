import { describe, expect, it } from "vitest";
import { moderationActBody } from "@aboutselphy/shared/moderation-act";
import { protectedTarget } from "./dashboard-actions";

const base = { targetId: "111111111111111111", botId: "222222222222222222", ownerId: "333333333333333333", staff: null } as const;

describe("protectedTarget", () => {
  it("allows an ordinary member", () => {
    expect(protectedTarget(base)).toBeNull();
  });
  it("refuses the bot, the owner and staff", () => {
    expect(protectedTarget({ ...base, targetId: base.botId })).toMatch(/myself/);
    expect(protectedTarget({ ...base, targetId: base.ownerId })).toMatch(/owner/);
    expect(protectedTarget({ ...base, staff: "moderator" })).toMatch(/Staff/);
    expect(protectedTarget({ ...base, staff: "admin" })).toMatch(/Staff/);
  });
});

describe("moderationActBody", () => {
  const ok = { type: "warn", targetId: "111111111111111111", reason: "spam", staffName: "Luke" } as const;
  it("needs a reason for warn, kick, ban and note, not for timeout, untimeout or unban", () => {
    for (const type of ["warn", "kick", "ban", "note"] as const) expect(moderationActBody.safeParse({ ...ok, type, reason: "" }).success, type).toBe(false);
    expect(moderationActBody.safeParse({ ...ok, type: "timeout", reason: "", durationSeconds: 600 }).success).toBe(true);
    expect(moderationActBody.safeParse({ ...ok, type: "unban", reason: "" }).success).toBe(true);
  });
  it("a timeout needs a length inside Discord's limits", () => {
    expect(moderationActBody.safeParse({ ...ok, type: "timeout" }).success).toBe(false);
    expect(moderationActBody.safeParse({ ...ok, type: "timeout", durationSeconds: 59 }).success).toBe(false);
    expect(moderationActBody.safeParse({ ...ok, type: "timeout", durationSeconds: 28 * 86_400 + 1 }).success).toBe(false);
    expect(moderationActBody.safeParse({ ...ok, type: "timeout", durationSeconds: 28 * 86_400 }).success).toBe(true);
  });
  it("only a ban may have a length (up to a year) or delete days", () => {
    expect(moderationActBody.safeParse({ ...ok, type: "ban", durationSeconds: 86_400, deleteDays: 3 }).success).toBe(true);
    expect(moderationActBody.safeParse({ ...ok, type: "ban", durationSeconds: 366 * 86_400 }).success).toBe(false);
    expect(moderationActBody.safeParse({ ...ok, type: "kick", durationSeconds: 60 }).success).toBe(false);
    expect(moderationActBody.safeParse({ ...ok, type: "warn", deleteDays: 2 }).success).toBe(false);
    expect(moderationActBody.safeParse({ ...ok, type: "ban", deleteDays: 8 }).success).toBe(false);
  });
  it("refuses a target that is not a snowflake and an unknown action", () => {
    expect(moderationActBody.safeParse({ ...ok, targetId: "luke" }).success).toBe(false);
    expect(moderationActBody.safeParse({ ...ok, type: "mute" }).success).toBe(false);
  });
});
