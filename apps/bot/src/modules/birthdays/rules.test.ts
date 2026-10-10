import { describe, expect, it } from "vitest";
import { birthdaySettingsSchema, isValidDay, isValidTimeZone } from "@aboutselphy/shared/birthdays";
import { celebrationDay, dayKey, daysUntil, formatDay, isBirthdayToday, renderGreeting, todayIn } from "./rules";

describe("isValidDay", () => {
  it("accepts real dates, including 29 February, and refuses the rest", () => {
    for (const [m, d] of [[1, 31], [2, 29], [4, 30], [12, 31]] as const) expect(isValidDay(m, d), `${m}/${d}`).toBe(true);
    for (const [m, d] of [[2, 30], [4, 31], [13, 1], [0, 1], [1, 0], [1.5, 1]] as const) expect(isValidDay(m, d), `${m}/${d}`).toBe(false);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names only", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    for (const bad of ["", "Mars/Base", "not a zone", "x".repeat(70)]) expect(isValidTimeZone(bad), bad).toBe(false);
  });
});

describe("settings", () => {
  const base = { enabled: true, channelId: "123456789012345678", roleId: "", message: "Hi {user}", timeZone: "Europe/Berlin" };
  it("needs a channel or a role when on, a message and a real time zone", () => {
    expect(birthdaySettingsSchema.safeParse(base).success).toBe(true);
    expect(birthdaySettingsSchema.safeParse({ ...base, channelId: "", roleId: "123456789012345678" }).success).toBe(true);
    expect(birthdaySettingsSchema.safeParse({ ...base, channelId: "" }).success).toBe(false);
    expect(birthdaySettingsSchema.safeParse({ ...base, enabled: false, channelId: "" }).success).toBe(true);
    expect(birthdaySettingsSchema.safeParse({ ...base, message: " " }).success).toBe(false);
    expect(birthdaySettingsSchema.safeParse({ ...base, timeZone: "Mars/Base" }).success).toBe(false);
  });
});

describe("todayIn", () => {
  it("uses the zone's midnight, not UTC's", () => {
    const instant = new Date("2026-03-01T23:30:00Z");
    expect(dayKey(todayIn(instant, "UTC"))).toBe("2026-03-01");
    expect(dayKey(todayIn(instant, "Europe/Berlin"))).toBe("2026-03-02");
    expect(dayKey(todayIn(instant, "America/Los_Angeles"))).toBe("2026-03-01");
  });
});

describe("celebrationDay and isBirthdayToday", () => {
  it("moves 29 February to the 28th in common years only", () => {
    expect(celebrationDay(2, 29, 2027)).toEqual({ month: 2, day: 28 });
    expect(celebrationDay(2, 29, 2028)).toEqual({ month: 2, day: 29 });
    expect(celebrationDay(2, 29, 1900)).toEqual({ month: 2, day: 28 });
    expect(celebrationDay(2, 29, 2000)).toEqual({ month: 2, day: 29 });
    expect(isBirthdayToday({ month: 2, day: 29 }, { year: 2027, month: 2, day: 28 })).toBe(true);
    expect(isBirthdayToday({ month: 2, day: 29 }, { year: 2028, month: 2, day: 28 })).toBe(false);
    expect(isBirthdayToday({ month: 7, day: 4 }, { year: 2026, month: 7, day: 4 })).toBe(true);
    expect(isBirthdayToday({ month: 7, day: 4 }, { year: 2026, month: 7, day: 5 })).toBe(false);
  });
});

describe("daysUntil", () => {
  it("counts to the next celebration, today being 0, wrapping over the new year", () => {
    const today = { year: 2026, month: 12, day: 30 };
    expect(daysUntil({ month: 12, day: 30 }, today)).toBe(0);
    expect(daysUntil({ month: 12, day: 31 }, today)).toBe(1);
    expect(daysUntil({ month: 1, day: 2 }, today)).toBe(3);
    expect(daysUntil({ month: 12, day: 29 }, today)).toBe(364);
    expect(daysUntil({ month: 2, day: 29 }, { year: 2027, month: 2, day: 27 })).toBe(1);
  });
});

describe("renderGreeting", () => {
  it("mentions the member, escapes everything else and cannot add pings", () => {
    const text = renderGreeting("Happy **birthday** {user}! @everyone <@&999999999999999999> {name}", { id: "111111111111111111", name: "Se*lphy" });
    expect(text).toContain("<@111111111111111111>");
    expect(text).toContain("Se\\*lphy");
    expect(text).not.toMatch(/(?<!\\)<@&/);
    expect(text).not.toMatch(/(?<!\\)\*\*birthday/);
  });
});

describe("formatDay", () => {
  it("prints day and month name", () => expect(formatDay(2, 29)).toBe("29 February"));
});
