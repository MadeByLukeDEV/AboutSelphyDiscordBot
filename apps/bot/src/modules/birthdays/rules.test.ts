import { describe, expect, it } from "vitest";
import { birthdaySettingsSchema, isMilestoneAge, isValidBirthYear, isValidDay, isValidTimeZone, staffBirthdayInput } from "@aboutselphy/shared/birthdays";
import { ageThisYear, celebrationDay, dayKey, daysUntil, formatDay, isBirthdayToday, renderGreeting, summaryDue, summaryLines, todayIn } from "./rules";

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
  const base = { enabled: true, channelId: "123456789012345678", roleId: "", message: "Hi {user}", timeZone: "Europe/Berlin", cardEnabled: false, cardMode: "background", cardTitle: "Happy birthday", cardSubtitle: "{date}", milestoneMessage: "", monthlySummary: false };
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

describe("fillDate", () => {
  it("fills {date} in the card subtitle", async () => {
    const { fillDate } = await import("@aboutselphy/shared/member-card");
    expect(fillDate("Born on {date}!", "29 February")).toBe("Born on 29 February!");
    expect(fillDate("{date}", "1 May")).toBe("1 May");
  });
});

describe("age, milestones and the monthly summary", () => {
  it("fills {age} only with a birth year", () => {
    expect(renderGreeting("Happy {age}th, {name}!", { id: "1", name: "Ann" }, 30)).toBe("Happy 30th, Ann!");
    expect(renderGreeting("Happy {age}th, {name}!", { id: "1", name: "Ann" })).toBe("Happy th, Ann!");
  });
  it("computes the age turned this year", () => {
    expect(ageThisYear(1996, 2026)).toBe(30);
    expect(ageThisYear(null, 2026)).toBeNull();
  });
  it("knows milestone ages", () => {
    for (const a of [18, 21, 25, 30, 40, 100]) expect(isMilestoneAge(a), String(a)).toBe(true);
    for (const a of [17, 19, 26, 35, 101]) expect(isMilestoneAge(a), String(a)).toBe(false);
    expect(isMilestoneAge(null)).toBe(false);
  });
  it("accepts only believable birth years", () => {
    expect(isValidBirthYear(2000, 2026)).toBe(true);
    expect(isValidBirthYear(2014, 2026)).toBe(false); // too young for Discord
    expect(isValidBirthYear(1900, 2026)).toBe(false);
    expect(isValidBirthYear(1999.5, 2026)).toBe(false);
  });
  it("arms the summary first, then posts once a month", () => {
    expect(summaryDue("2026-11", null)).toBe("seed");
    expect(summaryDue("2026-11", "2026-11")).toBe("none");
    expect(summaryDue("2026-12", "2026-11")).toBe("post");
  });
  it("lists the month in date order and cuts long lists", () => {
    const lines = summaryLines([{ userId: "b", month: 11, day: 20 }, { userId: "a", month: 11, day: 3 }], 2026);
    expect(lines).toEqual(["**3 November** · <@a>", "**20 November** · <@b>"]);
    expect(summaryLines([{ userId: "x", month: 2, day: 29 }], 2027)).toEqual(["**28 February** · <@x>"]);
    const many = Array.from({ length: 45 }, (_, i) => ({ userId: String(i), month: 5, day: 1 + (i % 28) }));
    const cut = summaryLines(many, 2026, 40);
    expect(cut).toHaveLength(41);
    expect(cut.at(-1)).toBe("... and 5 more");
  });
  it("validates a staff-set birthday", () => {
    const ok = { userId: "123456789012345678", month: 2, day: 29, year: 2000 };
    expect(staffBirthdayInput.safeParse(ok).success).toBe(true);
    expect(staffBirthdayInput.safeParse({ ...ok, year: null }).success).toBe(true);
    expect(staffBirthdayInput.safeParse({ ...ok, month: 2, day: 30 }).success).toBe(false);
    expect(staffBirthdayInput.safeParse({ ...ok, year: 2020 }).success).toBe(false);
  });
});
