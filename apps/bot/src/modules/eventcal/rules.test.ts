import { describe, expect, it } from "vitest";
import { eventRuleSchema, eventSourceSchema, gameEventSchema } from "@aboutselphy/shared/eventcal";
import type { ArticleEvent } from "@aboutselphy/shared/eventcal-article";
import type { CalEvent } from "./ics";
import { eventHash, eventMessage, firstSentence, foldSeries, recurrenceText, isPostable, matchesRule, mergeArticle, monthEvents, normalizeOffsets, planStages, monthLabel, monthlyEntries, monthlyHash, monthlyLine, monthlyMessages, overviewEntry, overviewEvents, overviewHash, overviewMessage, overviewSections, overviewWhen, whenText } from "./rules";

const ev = (over: Partial<CalEvent> = {}): CalEvent => ({
  key: "u|2026-09-18T10:00:00.000Z",
  summary: "Twitch Drops",
  start: new Date("2026-09-18T10:00:00Z"),
  end: new Date("2026-09-24T03:00:00Z"),
  allDay: false,
  description: "Link your accounts.",
  categories: ["twitch_drop"],
  image: null,
  video: null,
  color: 0x5f70c5,
  ...over,
});

describe("matchesRule", () => {
  it("matches by kind, together with words and tags", () => {
    const upd = ev({ summary: "October Game Update", categories: [], kind: "update" });
    expect(matchesRule(upd, { words: [], categories: [], kinds: ["update"] })).toBe(true);
    expect(matchesRule(upd, { words: [], categories: [], kinds: ["sale"] })).toBe(false);
    expect(matchesRule(upd, { words: ["nope"], categories: [], kinds: ["sale"] })).toBe(false);
    expect(matchesRule(upd, { words: ["game update"], categories: [], kinds: ["sale"] })).toBe(true);
    expect(matchesRule(ev({ kind: undefined }), { words: [], categories: [], kinds: ["update"] })).toBe(false);
  });
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
  it("groups into happening now, the next seven days, later and repeating", () => {
    const rep = ev({ summary: "Fight Nights", start: new Date("2026-09-22T18:00:00Z"), end: new Date("2026-12-01T19:00:00Z"), recurrence: "Every Tuesday" });
    const sections = overviewSections([far, a, b, running, rep], now);
    expect(sections.map((s) => s.title)).toEqual(["🟢 Happening now", "📅 Next 7 days", "🗓️ Later", "🔁 Repeating"]);
    expect(sections[0]!.entries[0]).toContain("**R**");
    expect(sections[1]!.entries[0]).toContain("**B**");
    expect(sections[1]!.entries[1]).toContain("**A**");
    expect(sections[2]!.entries[0]).toContain("**F**");
    expect(sections[3]!.entries[0]).toBe("🔁 **Fight Nights**\nEvery Tuesday");
  });
  it("writes each event on two lines with a short date and a relative time", () => {
    const drop = ev({ summary: "Twitch Drops", kind: "drop", allDay: true, start: new Date("2026-09-23T00:00:00Z"), end: new Date("2026-09-26T00:00:00Z") });
    const entry = overviewEntry(drop, now);
    const [name, when] = entry.split("\n");
    expect(name).toBe("🎁 **Twitch Drops**");
    expect(when).toMatch(/^Wed 23 Sep – Sat 26 Sep · starts <t:\d+:R>$/);
    expect(overviewWhen(ev({ allDay: true, start: new Date("2026-09-22T00:00:00Z"), end: null }))).toBe("Tue 22 Sep");
    expect(overviewWhen(ev({ allDay: false }))).toMatch(/^<t:\d+:f> → <t:\d+:t>$/);
  });
  it("says when a running event ends", () => {
    const runningEntry = overviewEntry(ev({ summary: "R", allDay: true, start: new Date("2026-09-14T00:00:00Z"), end: new Date("2026-09-16T00:00:00Z") }), now);
    expect(runningEntry).toMatch(/ · ends <t:\d+:R>$/);
  });
  it("cuts a long list and notes the rest", () => {
    const many = Array.from({ length: 30 }, (_, i) => ev({ summary: `E${i}`, start: new Date(now.getTime() + (i + 1) * 3_600_000) }));
    const sections = overviewSections(many, now, 25);
    expect(sections.flatMap((s) => s.entries)).toHaveLength(26);
    expect(sections.at(-1)!.entries.at(-1)).toBe("… and 5 more");
  });
  it("keeps every field within Discord's limit and escapes names", () => {
    const many = Array.from({ length: 25 }, (_, i) => ev({ summary: `**Event** @everyone ${"x".repeat(60)} ${i}`, start: new Date(now.getTime() + (i + 1) * 3_600_000) }));
    const message = overviewMessage(many, 30, now);
    const json = message.embeds[0]!.toJSON();
    for (const f of json.fields!) expect(f.value.length).toBeLessThanOrEqual(1024);
    expect(JSON.stringify(json)).not.toContain("**Event** @everyone");
    expect(message.allowedMentions).toEqual({ parse: [] });
  });
  it("has a stable fingerprint that changes with the list and when an event moves section", () => {
    expect(overviewHash([a, b], now)).toBe(overviewHash([a, b], now));
    expect(overviewHash([a, b], now)).not.toBe(overviewHash([a], now));
    expect(overviewHash([a], now)).not.toBe(overviewHash([a], new Date("2026-09-20T12:00:00Z")));
  });
  it("says so when nothing is planned", () => {
    expect(overviewMessage([], 30, now).embeds[0]!.toJSON().description).toContain("Nothing planned");
  });
});

describe("settings", () => {
  const rule = { name: "Drops", words: ["Twitch Drops"], categories: [], channelId: "123456789012345678", pingRoleId: "", leadDays: [7], enabled: true, sourceId: "src_1" };
  it("needs a word or a tag in a rule", () => {
    expect(eventRuleSchema.safeParse(rule).success).toBe(true);
    expect(eventRuleSchema.safeParse({ ...rule, words: [] }).success).toBe(false);
    expect(eventRuleSchema.safeParse({ ...rule, words: [], categories: ["twitch_drop"] }).success).toBe(true);
    expect(eventRuleSchema.safeParse({ ...rule, sourceId: "" }).success).toBe(false);
    expect(eventRuleSchema.safeParse({ ...rule, words: [], kinds: ["update"] }).success).toBe(true);
    expect(eventRuleSchema.safeParse({ ...rule, words: [], kinds: ["weird"] }).success).toBe(false);
  });
  it("takes only public https calendars and page templates", () => {
    const base = { name: "SoT", enabled: true, icsUrl: "https://calendar.google.com/calendar/ical/x/public/basic.ics", pageUrlTemplate: "https://www.seaofthieves.com/news/this-month-{month}{year}", overviewChannelId: "", overviewDays: 30, summaryChannelId: "" };
    expect(eventSourceSchema.safeParse(base).success).toBe(true);
    expect(eventSourceSchema.safeParse({ ...base, icsUrl: "", pageUrlTemplate: "" }).success).toBe(true);
    expect(eventSourceSchema.safeParse({ ...base, icsUrl: "http://calendar.google.com/x.ics" }).success).toBe(false);
    expect(eventSourceSchema.safeParse({ ...base, icsUrl: "https://localhost/x.ics" }).success).toBe(false);
    expect(eventSourceSchema.safeParse({ ...base, pageUrlTemplate: "https://localhost/{month}" }).success).toBe(false);
    expect(eventSourceSchema.safeParse({ ...base, overviewDays: 3 }).success).toBe(false);
  });
  it("checks an event edited by hand", () => {
    const ev = { sourceId: "src_1", title: "Drops", kind: "drop", allDay: true, start: "2026-10-23T00:00", end: "", description: "", summary: "", items: ["Bucket"], imageUrl: "", videoUrl: "" };
    expect(gameEventSchema.safeParse(ev).success).toBe(true);
    expect(gameEventSchema.safeParse({ ...ev, kind: "weird" }).success).toBe(false);
    expect(gameEventSchema.safeParse({ ...ev, start: "tomorrow" }).success).toBe(false);
    expect(gameEventSchema.safeParse({ ...ev, videoUrl: "https://example.com/x.png" }).success).toBe(false);
    expect(gameEventSchema.safeParse({ ...ev, videoUrl: "https://youtu.be/abc" }).success).toBe(true);
    expect(gameEventSchema.safeParse({ ...ev, imageUrl: "http://example.com/a.png" }).success).toBe(false);
  });
});

describe("merging a news article into the calendar", () => {
  const day = (s: string) => new Date(`${s}T00:00:00Z`);
  const win: [Date, Date] = [day("2026-10-01"), day("2026-11-30")];
  const calDrops = ev({ key: "cal-drops", summary: "Twitch Drops", start: new Date("2026-10-23T10:00:00Z"), end: new Date("2026-10-26T10:00:00Z"), description: "Short text." });
  const fight = ev({ key: "cal-fight", summary: "Fight Nights", start: new Date("2026-10-20T10:00:00Z"), end: new Date("2026-10-21T10:00:00Z"), description: "", categories: ["in_game"] });
  const art = (over: Partial<ArticleEvent>): ArticleEvent => ({ title: "Twitch Drops", start: day("2026-10-23"), end: day("2026-10-26"), everyWeekday: null, text: "Article text with the drops.", categories: ["twitch_drop"], image: null, video: null, ...over });

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

describe("media on posts", () => {
  it("puts a video link in the text so Discord shows the player, and the picture in the embed", () => {
    const m = eventMessage(ev({ video: "https://www.youtube.com/watch?v=l-gDZD1_jiw", image: "https://assets.example.com/a.png" }), "123456789012345678");
    expect(m.content).toBe("<@&123456789012345678>\nhttps://www.youtube.com/watch?v=l-gDZD1_jiw");
    expect(m.embeds[0]!.toJSON().image?.url).toBe("https://assets.example.com/a.png");
    expect(eventMessage(ev({ video: "https://youtu.be/x1" }), null).content).toBe("https://youtu.be/x1");
  });
  it("takes the article's picture and video over the calendar's", () => {
    const cal = ev({ key: "c", summary: "October Game Update", image: "https://sea-of-thieves-calendar.s3.amazonaws.com/x.png", start: new Date("2026-10-22T09:00:00Z") });
    const art: ArticleEvent = { title: "October Game Update", start: new Date("2026-10-22T00:00:00Z"), end: null, everyWeekday: null, text: "Update.", categories: [], image: "https://assets.example.com/b.png", video: "https://youtu.be/abc" };
    const [m] = mergeArticle([cal], [art], new Date("2026-10-01T00:00:00Z"), new Date("2026-11-30T00:00:00Z"));
    expect(m!.image).toBe("https://assets.example.com/b.png");
    expect(m!.video).toBe("https://youtu.be/abc");
  });
  it("changes the hash when the video changes", () => {
    expect(eventHash(ev())).not.toBe(eventHash(ev({ video: "https://youtu.be/abc" })));
  });
});

describe("the monthly summary", () => {
  const at = (iso: string, over: Partial<CalEvent> = {}) => ev({ key: iso + (over.summary ?? ""), start: new Date(iso), end: new Date(new Date(iso).getTime() + 86_400_000), ...over });
  const weekly = [6, 13, 20, 27].map((d) => at(`2026-10-${String(d).padStart(2, "0")}T10:00:00Z`, { summary: "Fight Nights" }));

  it("keeps every event of the month, whatever a rule matches, and the ones that run into it", () => {
    const events = [at("2026-09-30T10:00:00Z", { summary: "Runs in", end: new Date("2026-10-03T10:00:00Z") }), at("2026-10-22T09:00:00Z", { summary: "Update" }), at("2026-11-02T10:00:00Z", { summary: "Next month" })];
    expect(monthEvents(events, 2026, 10).map((e) => e.summary)).toEqual(["Runs in", "Update"]);
  });
  it("folds a weekly event into one entry and keeps single ones", () => {
    const entries = monthlyEntries([...weekly, at("2026-10-22T09:00:00Z", { summary: "Update" })]);
    expect(entries.map((e) => [e.event.summary, e.weekly])).toEqual([["Fight Nights", 2], ["Update", null]]);
  });
  it("does not fold events that are not a week apart, or fewer than three", () => {
    expect(monthlyEntries([weekly[0]!, weekly[1]!]).every((e) => e.weekly === null)).toBe(true);
    expect(monthlyEntries([weekly[0]!, weekly[1]!, at("2026-10-28T10:00:00Z", { summary: "Fight Nights" })]).every((e) => e.weekly === null)).toBe(true);
  });
  it("writes a line with the dates and an escaped blurb", () => {
    const line = monthlyLine({ event: ev({ summary: "Twitch Drops **x**" }), weekly: null }, "Watch @everyone [x](https://evil.example)");
    expect(line).toMatch(/^\*\*Twitch Drops \\\*\\\*x\\\*\\\*\*\* · <t:\d+:D> – <t:\d+:D>\n> /);
    expect(line).not.toContain("](https");
    expect(monthlyLine({ event: weekly[0]!, weekly: 2 }, "")).toBe("**Fight Nights** · every Tuesday");
  });
  it("shows a one-day event with one date", () => {
    expect(monthlyLine({ event: ev({ allDay: true, start: new Date("2026-10-22T00:00:00Z"), end: null }), weekly: null }, "")).toMatch(/· <t:\d+:D>$/);
  });
  it("cuts a first sentence", () => {
    expect(firstSentence("The update lands. It has more. And a third one here.", 25)).toBe("The update lands.");
    expect(firstSentence("The update lands. It has more.", 140)).toBe("The update lands. It has more.");
    expect(firstSentence("x".repeat(300), 50)).toHaveLength(50);
  });
  it("splits long lists into messages that fit Discord's limits", () => {
    const lines = Array.from({ length: 120 }, (_, i) => `**Event ${i}** · <t:1:D>\n> ${"words ".repeat(20)}`);
    const messages = monthlyMessages(lines, "October 2026");
    expect(messages.length).toBeGreaterThan(1);
    for (const m of messages) {
      expect(m.embeds.length).toBeLessThanOrEqual(10);
      expect(m.embeds.reduce((n, e) => n + (e.toJSON().description?.length ?? 0) + (e.toJSON().title?.length ?? 0), 0)).toBeLessThanOrEqual(6000);
      for (const e of m.embeds) expect(e.toJSON().description!.length).toBeLessThanOrEqual(4096);
    }
    expect(messages[0]!.embeds[0]!.toJSON().title).toBe("October 2026: what's on");
  });
  it("still posts something when nothing is planned, and fingerprints the lines", () => {
    expect(monthlyMessages([], "October 2026")[0]!.embeds[0]!.toJSON().description).toContain("Nothing");
    expect(monthlyHash(["a"])).toBe(monthlyHash(["a"]));
    expect(monthlyHash(["a"])).not.toBe(monthlyHash(["b"]));
    expect(monthLabel(2026, 10)).toBe("October 2026");
  });
});

describe("reminders", () => {
  const start = new Date("2026-10-23T00:00:00Z");
  const at = (iso: string) => new Date(iso);

  it("cleans lead times: whole days, no duplicates, largest first, one week when empty", () => {
    expect(normalizeOffsets([2, 7, 7, -1, 99, 1.5])).toEqual([7, 2]);
    expect(normalizeOffsets([])).toEqual([7]);
  });
  it("posts the announcement when the first lead time is reached", () => {
    expect(planStages({ start, allDay: true }, at("2026-10-16T12:00:00Z"), [7, 2])).toEqual([{ stage: 0, offset: 7, post: true }]);
  });
  it("posts nothing before the first lead time and nothing after the event started", () => {
    expect(planStages({ start, allDay: true }, at("2026-10-10T12:00:00Z"), [7, 2])).toEqual([]);
    expect(planStages({ start, allDay: true }, at("2026-10-24T12:00:00Z"), [7, 2])).toEqual([]);
  });
  it("posts the reminder when the second lead time is reached, and only that one", () => {
    const steps = planStages({ start, allDay: true }, at("2026-10-21T12:00:00Z"), [7, 2]);
    expect(steps).toEqual([
      { stage: 0, offset: 7, post: false },
      { stage: 1, offset: 2, post: true },
    ]);
  });
  it("marks a missed announcement as overtaken instead of posting twice", () => {
    const steps = planStages({ start, allDay: true }, at("2026-10-21T18:00:00Z"), [14, 7, 2]);
    expect(steps.filter((s) => s.post).map((s) => s.offset)).toEqual([2]);
  });
  it("labels a reminder with the start time and keeps the role ping", () => {
    const e = ev({ start });
    const m = eventMessage(e, "123456789012345678", null, { reminder: true });
    expect(m.content).toMatch(/^<@&123456789012345678> ⏰ \*\*Reminder:\*\* starts <t:\d+:R>$/);
    expect(eventMessage(e, "123456789012345678", null).content).toBe("<@&123456789012345678>");
    expect(eventMessage(e, null, null, { reminder: true }).content).toMatch(/^⏰ /);
  });
  it("accepts one to four lead times on a rule, and an event override", () => {
    const rule = { name: "Drops", words: ["x"], categories: [], channelId: "123456789012345678", pingRoleId: "", enabled: true, sourceId: "s" };
    expect(eventRuleSchema.parse({ ...rule, leadDays: [2, 7] }).leadDays).toEqual([7, 2]);
    expect(eventRuleSchema.safeParse({ ...rule, leadDays: [] }).success).toBe(false);
    expect(eventRuleSchema.safeParse({ ...rule, leadDays: [1, 2, 3, 4, 5] }).success).toBe(false);
    expect(eventRuleSchema.safeParse({ ...rule, leadDays: [61] }).success).toBe(false);
    const ge = { sourceId: "s", title: "t", kind: "event", allDay: true, start: "2026-10-23T00:00", end: "", description: "", summary: "", items: [], imageUrl: "", videoUrl: "" };
    expect(gameEventSchema.parse(ge).reminderDays).toEqual([]);
    expect(gameEventSchema.parse({ ...ge, reminderDays: [1, 5] }).reminderDays).toEqual([5, 1]);
  });
});

describe("repeating series", () => {
  const DAY = 86_400_000;
  const weekly = (name: string, firstIso: string, count: number, step = 7): CalEvent[] =>
    Array.from({ length: count }, (_, i) => ev({ key: `${name}|${i}`, summary: name, start: new Date(new Date(firstIso).getTime() + i * step * DAY), end: new Date(new Date(firstIso).getTime() + i * step * DAY + 3_600_000), categories: [] }));
  const now = new Date("2026-10-15T12:00:00Z");

  it("names how it repeats", () => {
    expect(recurrenceText(new Date("2026-10-20T18:00:00Z"), 7 * DAY)).toBe("Every Tuesday");
    expect(recurrenceText(new Date("2026-10-20T18:00:00Z"), 14 * DAY)).toBe("Every other Tuesday");
    expect(recurrenceText(new Date("2026-10-20T18:00:00Z"), DAY)).toBe("Every day");
    expect(recurrenceText(new Date("2026-10-20T18:00:00Z"), 10 * DAY)).toBe("Every 10 days");
  });
  it("folds many weekly occurrences into one entry that starts at the next one and runs to the last", () => {
    const folded = foldSeries(weekly("Fight Nights", "2026-10-06T18:00:00Z", 12), now);
    expect(folded).toHaveLength(1);
    expect(folded[0]!.recurrence).toBe("Every Tuesday");
    expect(folded[0]!.key).toBe("series|fightnights");
    expect(folded[0]!.start.toISOString()).toBe("2026-10-20T18:00:00.000Z");
    expect(folded[0]!.end!.toISOString()).toBe("2026-12-22T19:00:00.000Z");
  });
  it("folds each series on its own and leaves single events alone", () => {
    const single = ev({ key: "single", summary: "Community Weekend" });
    const out = foldSeries([...weekly("Fight Nights", "2026-10-06T18:00:00Z", 6), ...weekly("Emissaries", "2026-10-07T10:00:00Z", 5, 1), single], now);
    expect(out.map((e) => e.summary).sort()).toEqual(["Community Weekend", "Emissaries", "Fight Nights"]);
    expect(out.find((e) => e.summary === "Emissaries")!.recurrence).toBe("Every day");
    expect(out.find((e) => e.key === "single")!.recurrence).toBeUndefined();
  });
  it("keeps two occurrences, uneven ones and article entries as they are", () => {
    expect(foldSeries(weekly("Pair", "2026-10-06T18:00:00Z", 2), now)).toHaveLength(2);
    const uneven = [ev({ key: "a", summary: "Odd", start: new Date("2026-10-01T00:00:00Z") }), ev({ key: "b", summary: "Odd", start: new Date("2026-10-08T00:00:00Z") }), ev({ key: "c", summary: "Odd", start: new Date("2026-10-30T00:00:00Z") })];
    expect(foldSeries(uneven, now)).toHaveLength(3);
    const art = [1, 2, 3].map((i) => ev({ key: `article|odd|${i}`, summary: "Odd", start: new Date(`2026-10-0${i}T00:00:00Z`) }));
    expect(foldSeries(art, now)).toHaveLength(3);
  });
  it("shows a series as one line in the overview and the monthly summary", () => {
    const [series] = foldSeries(weekly("Fight Nights", "2026-10-06T18:00:00Z", 8), now);
    expect(overviewEntry(series!, now)).toBe("🔁 **Fight Nights**\nEvery Tuesday");
    expect(monthlyLine({ event: series!, weekly: null }, "")).toBe("**Fight Nights** · Every Tuesday");
  });
});

describe("posting an occurrence of a series", () => {
  const series = ev({ summary: "Fight Nights", start: new Date("2026-10-20T18:00:00Z"), end: new Date("2026-12-22T19:00:00Z"), recurrence: "Every Tuesday", categories: [] });

  it("does not change the fingerprint when the series' last occurrence moves on", () => {
    const later = { ...series, end: new Date("2027-01-05T19:00:00Z") };
    expect(eventHash(later)).toBe(eventHash(series));
    expect(eventHash({ ...series, start: new Date("2026-10-27T18:00:00Z") })).not.toBe(eventHash(series));
  });
  it("shows the next time and how it repeats, without an end", () => {
    const fields = eventMessage(series, null).embeds[0]!.toJSON().fields!;
    expect(fields.map((f) => f.name)).toEqual(["Next", "Repeats"]);
    expect(fields[1]!.value).toBe("Every Tuesday");
  });
  it("keeps the usual Starts and Ends for a normal event", () => {
    expect(eventMessage(ev(), null).embeds[0]!.toJSON().fields!.map((f) => f.name)).toEqual(["Starts", "Ends"]);
  });
});

