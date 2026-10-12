import { describe, expect, it } from "vitest";
import { antiBotSettingsSchema } from "@aboutselphy/shared/antibot";
import { judge, type Writer } from "./rules";

const member: Writer = { automated: false, owner: false, staff: null, powerful: false };

describe("judge", () => {
  it("catches an ordinary member", () => {
    expect(judge(member)).toEqual({ act: true });
  });
  it("never catches bots, webhooks, the owner, staff or people with real power", () => {
    expect(judge({ ...member, automated: true })).toEqual({ act: false, reason: "automated" });
    expect(judge({ ...member, owner: true })).toEqual({ act: false, reason: "owner" });
    expect(judge({ ...member, staff: "moderator" })).toEqual({ act: false, reason: "staff" });
    expect(judge({ ...member, staff: "admin" })).toEqual({ act: false, reason: "staff" });
    expect(judge({ ...member, powerful: true })).toEqual({ act: false, reason: "powerful" });
  });
});

describe("settings", () => {
  const ok = { enabled: true, channelId: "123456789012345678", timeoutSeconds: 604800, dryRun: false };
  it("needs a channel to be switched on, but not to be off", () => {
    expect(antiBotSettingsSchema.safeParse(ok).success).toBe(true);
    expect(antiBotSettingsSchema.safeParse({ ...ok, channelId: "" }).success).toBe(false);
    expect(antiBotSettingsSchema.safeParse({ ...ok, enabled: false, channelId: "" }).success).toBe(true);
  });
  it("keeps the timeout inside Discord's limits", () => {
    expect(antiBotSettingsSchema.safeParse({ ...ok, timeoutSeconds: 59 }).success).toBe(false);
    expect(antiBotSettingsSchema.safeParse({ ...ok, timeoutSeconds: 28 * 86_400 }).success).toBe(true);
    expect(antiBotSettingsSchema.safeParse({ ...ok, timeoutSeconds: 28 * 86_400 + 1 }).success).toBe(false);
  });
  it("refuses an address that is not a snowflake", () => {
    expect(antiBotSettingsSchema.safeParse({ ...ok, channelId: "general" }).success).toBe(false);
  });
});
