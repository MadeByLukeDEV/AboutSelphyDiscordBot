import { describe, expect, it } from "vitest";
import { eventSettingsSchema, eventRuleSchema } from "@aboutselphy/shared/eventcal";
import type { ArticleEvent } from "@aboutselphy/shared/eventcal-article";
import type { CalEvent } from "./ics";
import { eventHash, eventMessage, isPostable, matchesRule, mergeArticle, overviewEvents, overviewHash, overviewLines, overviewMessage, whenText } from "./rules";

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

describe("merging a news article into the calendar", () => {
  const day = (s: string) => new Date(`${s}T00:00:00Z`);
  const win: [Date, Date] = [day("2026-10-01"), day("2026-11-30")];
  const calDrops = ev({ key: "cal-drops", summary: "Twitch Drops", start: new Date("2026-10-23T10:00:00Z"), end: new Date("2026-10-26T10:00:00Z"), description: "Short text." });
  const fight = ev({ key: "cal-fight", summary: "Fight Nights", start: new Date("2026-10-20T10:00:00Z"), end: new Date("2026-10-21T10:00:00Z"), description: "", categories: ["in_game"] });
  const art = (over: Partial<ArticleEvent>): ArticleEvent => ({ title: "Twitch Drops", start: day("2026-10-23"), end: day("2026-10-26"), everyWeekday: null, text: "Article text with the drops.", categories: ["twitch_drop"], ...over });

  it("gives a calendar event the article's text and keeps its exact times", () => {
    const [m] = mergeArticle([calDrops], [art({})], ...win);
    expect(m!.description).toBe("Article text with the drops.");
    expect(m!.start.toISOString()).toBe("2026-10-23T10:00:00.000Z");
    expect(m!.key).toBe("cal-drops");
  });
  it("gives a repeating section's text to every event of that name", () => {
    const merged = mergeArticle([fight, { ...fight, key: "cal-fight2", start: new Date("2026-10-27T10:00:00Z") }], [art({ title: "Fight Nights", start: null, end: null, everyWeekday: 2, text: "Fight text." })], ...win);
    expect(merged.map((e) => e.description)).toEqual(["Fight text.", "Fight text."]);
  });
  it("adds a dated section the calendar doesn't have, as an all-day event", () => {
    const merged = mergeArticle([calDrops], [art({ title: "October Game Update", start: day("2026-10-22"), end: null, text: "Update text.", categories: [] })], ...win);
    const added = merged.find((e) => e.summary === "October Game Update")!;
    expect(added.allDay).toBe(true);
    expect(added.key).toBe("article|octobergameupdate|2026-10-22");
    expect(added.description).toBe("Update text.");
    expect(merged[0]!.summary).toBe("October Game Update");
  });
  it("matches a longer article name to a shorter calendar name, but not on other days", () => {
    const cw = ev({ key: "cw", summary: "Community Weekend", start: new Date("2026-10-23T10:00:00Z"), description: "" });
    expect(mergeArticle([cw], [art({ title: "Season 21 Community Weekend", text: "CW text." })], ...win)[0]!.description).toBe("CW text.");
    expect(mergeArticle([cw], [art({ title: "Season 21 Community Weekend", start: day("2026-11-20"), end: null, text: "Other." })], ...win).find((e) => e.key === "cw")!.description).toBe("");
  });
  it("leaves out article events outside the window, and never changes the input", () => {
    const original = { ...calDrops };
    const merged = mergeArticle([calDrops], [art({ title: "Old", start: day("2026-01-05"), end: null })], ...win);
    expect(merged).toHaveLength(1);
    expect(calDrops).toEqual(original);
  });
  it("keeps a date-only event postable for its whole day", () => {
    const allDay = ev({ allDay: true, start: day("2026-10-22") });
    expect(isPostable(allDay, new Date("2026-10-22T15:00:00Z"), 0)).toBe(true);
    expect(isPostable(allDay, new Date("2026-10-23T00:30:00Z"), 0)).toBe(false);
  });
});
