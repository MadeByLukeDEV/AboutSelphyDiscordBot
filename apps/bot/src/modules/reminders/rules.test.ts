import { describe, expect, it } from "vitest";
import { MAX_REMINDER_SECONDS, reminderSettingsSchema } from "@aboutselphy/shared/reminders";
import { isAllowedDelay, reminderLine, reminderText } from "./rules";

describe("isAllowedDelay", () => {
  it("allows one minute to one year", () => {
    expect(isAllowedDelay(60)).toBe(true);
    expect(isAllowedDelay(MAX_REMINDER_SECONDS)).toBe(true);
    for (const bad of [null, 0, 59, MAX_REMINDER_SECONDS + 1, -5]) expect(isAllowedDelay(bad), String(bad)).toBe(false);
  });
});

describe("settings", () => {
  it("keeps the per-member limit sane", () => {
    const card = { channelId: "", cardEnabled: false, cardMode: "background", cardTitle: "Reminder" };
    expect(reminderSettingsSchema.safeParse({ enabled: true, maxPerUser: 10, ...card }).success).toBe(true);
    expect(reminderSettingsSchema.safeParse({ enabled: true, maxPerUser: 0, ...card }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ enabled: true, maxPerUser: 51, ...card }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ enabled: true, maxPerUser: 5, ...card, cardMode: "stretch" }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ enabled: true, maxPerUser: 5, ...card, channelId: "123456789012345678" }).success).toBe(true);
    expect(reminderSettingsSchema.safeParse({ enabled: true, maxPerUser: 5, ...card, channelId: "general" }).success).toBe(false);
  });
});

describe("reminderText", () => {
  const at = new Date("2026-05-01T10:00:00Z");
  it("pings only the owner and escapes the message", () => {
    const text = reminderText({ userId: "111111111111111111", message: "call **mom** @everyone <@&999999999999999999>", remindAt: at }, at);
    expect(text).toContain("<@111111111111111111>");
    expect(text).not.toMatch(/(?<!\\)<@&/);
    expect(text).not.toMatch(/(?<!\\)\*\*mom/);
    expect(text).not.toContain("the bot was away");
  });

  it("says so when it is delivered much later than planned", () => {
    const text = reminderText({ userId: "111111111111111111", message: "x", remindAt: at }, new Date(at.getTime() + 3_600_000));
    expect(text).toContain("the bot was away");
  });
});

describe("reminderLine", () => {
  it("numbers lines and shortens long messages", () => {
    const line = reminderLine({ id: "a", message: "y".repeat(300), remindAt: new Date(0) }, 2);
    expect(line.startsWith("**3.**")).toBe(true);
    expect(line.length).toBeLessThan(140);
  });
});
