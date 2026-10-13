import { describe, expect, it } from "vitest";
import { eventSettingsSchema, eventRuleSchema } from "@aboutselphy/shared/eventcal";
import type { CalEvent } from "./ics";
import { eventHash, eventMessage, isPostable, matchesRule, overviewEvents, overviewHash, overviewLines, overviewMessage, whenText } from "./rules";

const ev = (over: Partial<CalEvent> = {}): CalEvent => ({
  key: "u|2026-09-18T10:00:00.000Z",
  summary: "Twitch Drops",
  start: new Date("2026-09-18T10:00:00Z"),
  end: new Date("2026-09-24T03:00:00Z"),
  allDay: false,
  description: "Link your accounts.",
  categories: ["twitch_drop"],
  image: null,
  color: 0x5f70c5,
  ...over,
});

describe("matchesRule", () => {
  it("matches the name by any word, any case", () => {
    expect(matchesRule(ev(), { words: ["twitch"], categories: [] })).toBe(true);
    expect(matchesRule(ev(), { words: ["fight"], categories: [] })).toBe(false);
  });
  it("matches by tag", () => {
    expect(matchesRule(ev(), { words: [], categories: ["TWITCH_DROP"] })).toBe(true);
    expect(matchesRule(ev(), { words: [], categories: ["in_game"] })).toBe(false);
  });
  it("matches when either side does, and ignores blank terms", () => {
    expect(matchesRule(ev(), { words: ["nope"], categories: ["twitch_drop"] })).toBe(true);
    expect(matchesRule(ev(), { words: [" "], categories: [""] })).toBe(false);
  });
});

describe("isPostable", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  it("posts within the lead time and not before", () => {
    expect(isPostable(ev(), now, 7)).toBe(true);
    expect(isPostable(ev({ start: new Date("2026-10-30T10:00:00Z") }), now, 7)).toBe(false);
  });
  it("never posts something that already started", () => {
    expect(isPostable(ev({ start: new Date("2026-09-15T11:00:00Z") }), now, 7)).toBe(false);
  });
  it("0 days ahead means on the day", () => {
    expect(isPostable(ev({ start: new Date("2026-09-15T20:00:00Z") }), now, 0)).toBe(true);
    expect(isPostable(ev({ start: new Date("2026-09-17T20:00:00Z") }), now, 0)).toBe(false);
  });
});

describe("hash and messages", () => {
  it("changes when what is shown changes", () => {
    expect(eventHash(ev())).toBe(eventHash(ev()));
    expect(eventHash(ev())).not.toBe(eventHash(ev({ description: "More." })));
    expect(eventHash(ev())).not.toBe(eventHash(ev({ start: new Date("2026-09-19T10:00:00Z") })));
  });
  it("escapes the calendar's text and only pings the rule's role", () => {
    const m = eventMessage(ev({ summary: "**Big** @everyone", description: "[x](https://evil.example) <@&1>" }), "123456789012345678");
    const json = m.embeds[0]!.toJSON();
    expect(json.title).not.toContain("**Big**");
    expect(json.description).not.toContain("](https");
    expect(m.content).toBe("<@&123456789012345678>");
    expect(m.allowedMentions).toEqual({ parse: [], roles: ["123456789012345678"] });
    expect(eventMessage(ev(), null).allowedMentions).toEqual({ parse: [] });
  });
  it("shows the start as Discord times", () => {
    expect(whenText(ev()).starts).toMatch(/^<t:\d+:F> \(<t:\d+:R>\)$/);
    expect(whenText(ev({ end: null })).ends).toBeNull();
    expect(whenText(ev({ allDay: true })).starts).toMatch(/:D>$/);
  });
});

describe("overview", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const a = ev({ summary: "A", start: new Date("2026-09-20T10:00:00Z"), end: new Date("2026-09-21T10:00:00Z") });
  const b = ev({ summary: "B", start: new Date("2026-09-16T10:00:00Z"), end: new Date("2026-09-17T10:00:00Z") });
  const running = ev({ summary: "R", start: new Date("2026-09-10T10:00:00Z"), end: new Date("2026-09-16T10:00:00Z") });
  const past = ev({ summary: "P", start: new Date("2026-09-01T10:00:00Z"), end: new Date("2026-09-02T10:00:00Z") });
  const far = ev({ summary: "F", start: new Date("2026-12-01T10:00:00Z"), end: null });
  it("lists running and upcoming events, soonest first, within the window", () => {
    expect(overviewEvents([a, b, running, past, far], now, 30).map((e) => e.summary)).toEqual(["R", "B", "A"]);
  });
  it("cuts a long list and notes the rest", () => {
    const many = Array.from({ length: 30 }, (_, i) => ev({ summary: `E${i}`, start: new Date(now.getTime() + i * 3_600_000) }));
    const lines = overviewLines(many, 25);
    expect(lines).toHaveLength(26);
    expect(lines.at(-1)).toBe("... and 5 more");
  });
  it("has a stable fingerprint that changes with the list", () => {
    expect(overviewHash([a, b])).toBe(overviewHash([a, b]));
    expect(overviewHash([a, b])).not.toBe(overviewHash([a]));
  });
  it("says so when nothing is planned", () => {
    expect(overviewMessage([], 30).embeds[0]!.toJSON().description).toContain("Nothing planned");
  });
});

describe("settings", () => {
  const rule = { name: "Drops", words: ["Twitch Drops"], categories: [], channelId: "123456789012345678", pingRoleId: "", daysAhead: 7, enabled: true };
  it("needs a word or a tag in a rule", () => {
    expect(eventRuleSchema.safeParse(rule).success).toBe(true);
    expect(eventRuleSchema.safeParse({ ...rule, words: [] }).success).toBe(false);
    expect(eventRuleSchema.safeParse({ ...rule, words: [], categories: ["twitch_drop"] }).success).toBe(true);
  });
  it("takes only public https calendars", () => {
    const base = { enabled: true, icsUrl: "https://calendar.google.com/calendar/ical/x/public/basic.ics", overviewChannelId: "", overviewDays: 30 };
    expect(eventSettingsSchema.safeParse(base).success).toBe(true);
    expect(eventSettingsSchema.safeParse({ ...base, icsUrl: "http://calendar.google.com/x.ics" }).success).toBe(false);
    expect(eventSettingsSchema.safeParse({ ...base, icsUrl: "https://localhost/x.ics" }).success).toBe(false);
    expect(eventSettingsSchema.safeParse({ ...base, overviewDays: 3 }).success).toBe(false);
  });
});
