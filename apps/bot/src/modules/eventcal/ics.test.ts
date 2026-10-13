import { describe, expect, it } from "vitest";
import { parseCalendar, parseWhen, splitDescription, unfold, zonedToUtc } from "./ics";

const drops = [
  "BEGIN:VEVENT",
  "DTSTART:20260918T100000Z",
  "DTEND:20260924T030000Z",
  "UID:drop1@google.com",
  "DESCRIPTION:To take part\\, link your accounts.\\n\\nYou can expect Gold\\, Renown!\\n||EVENT_INFO||{\"filter\":[\"twitch_drop\"]\\,\"large_image\":\"https://sea-of-thieves-calendar.s3.us-east-1.amazonaws.com/a/b.png\"\\,\"event-color\":\"#5f70c5\"\\,\"duration\":\"6 days\"}",
  "STATUS:CONFIRMED",
  "SUMMARY:Twitch Drops",
  "END:VEVENT",
].join("\r\n");

const fight = [
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Phoenix:20260714T030000",
  "DTEND;TZID=America/Phoenix:20260715T030000",
  "RRULE:FREQ=WEEKLY;BYDAY=TU",
  "EXDATE;TZID=America/Phoenix:20260929T030000",
  "UID:fight@google.com",
  "DESCRIPTION:Prepare for battle<br>||EVENT_INFO||{\"filter\":[\"in_game\"]\\,\"small_image\":\"<a href=\"https://sea-of-thieves-calendar.s3.amazonaws.com/x.png\" target=\"_blank\">https://sea-of-thieves-calendar.s3.amazonaws.com/x.png</a>\"\\,\"event-color\":\"#ab101a\"<span>\\,\"condense\":\"true\"</span>}",
  "SUMMARY:Fight Nights",
  "END:VEVENT",
].join("\r\n");

const cancelled = ["BEGIN:VEVENT", "DTSTART:20260920T100000Z", "UID:c@x", "STATUS:CANCELLED", "SUMMARY:Gone", "END:VEVENT"].join("\r\n");
const wrap = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join("\r\n")}\r\nEND:VCALENDAR\r\n`;
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("reading events", () => {
  it("reads a one-off event with its description, tags, picture and colour", () => {
    const [e] = parseCalendar(wrap(drops), day("2026-09-01"), day("2026-10-31"));
    expect(e!.summary).toBe("Twitch Drops");
    expect(e!.start.toISOString()).toBe("2026-09-18T10:00:00.000Z");
    expect(e!.end!.toISOString()).toBe("2026-09-24T03:00:00.000Z");
    expect(e!.description).toBe("To take part, link your accounts.\n\nYou can expect Gold, Renown!");
    expect(e!.categories).toEqual(["twitch_drop"]);
    expect(e!.image).toBe("https://sea-of-thieves-calendar.s3.us-east-1.amazonaws.com/a/b.png");
    expect(e!.color).toBe(0x5f70c5);
  });
  it("keeps only the window, and drops cancelled events", () => {
    expect(parseCalendar(wrap(drops, cancelled), day("2026-10-01"), day("2026-10-31"))).toEqual([]);
    expect(parseCalendar(wrap(drops, cancelled), day("2026-09-01"), day("2026-10-31")).map((e) => e.summary)).toEqual(["Twitch Drops"]);
  });
  it("shows an event that started earlier but still runs", () => {
    expect(parseCalendar(wrap(drops), day("2026-09-22"), day("2026-10-31"))).toHaveLength(1);
  });
});

describe("weekly repeats", () => {
  it("expands a weekly rule in its own time zone and honours EXDATE", () => {
    const list = parseCalendar(wrap(fight), day("2026-09-20"), day("2026-10-14"));
    // Tuesdays at 03:00 in Phoenix (UTC-7, no daylight saving) = 10:00 UTC; 29 Sep is excluded.
    expect(list.map((e) => e.start.toISOString())).toEqual(["2026-09-22T10:00:00.000Z", "2026-10-06T10:00:00.000Z", "2026-10-13T10:00:00.000Z"]);
    expect(list[0]!.end!.toISOString()).toBe("2026-09-23T10:00:00.000Z");
  });
  it("never starts before the first event", () => {
    expect(parseCalendar(wrap(fight), day("2026-07-01"), day("2026-07-20")).map((e) => e.start.toISOString())).toEqual(["2026-07-14T10:00:00.000Z"]);
  });
  it("gives every occurrence its own key", () => {
    const keys = parseCalendar(wrap(fight), day("2026-09-20"), day("2026-10-14")).map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("cleans the machine part and only accepts the calendar's own picture host", () => {
    const [e] = parseCalendar(wrap(fight), day("2026-09-20"), day("2026-09-25"));
    expect(e!.description).toBe("Prepare for battle");
    expect(e!.image).toBe("https://sea-of-thieves-calendar.s3.amazonaws.com/x.png");
    expect(e!.color).toBe(0xab101a);
    const evil = drops.replace("https://sea-of-thieves-calendar.s3.us-east-1.amazonaws.com/a/b.png", "https://evil.example/a.png");
    expect(parseCalendar(wrap(evil), day("2026-09-01"), day("2026-10-31"))[0]!.image).toBeNull();
  });
});

describe("helpers", () => {
  it("unfolds long lines", () => {
    expect(unfold("A:1\r\n 2\r\nB:3")).toEqual(["A:12", "B:3"]);
  });
  it("converts zoned times, with daylight saving", () => {
    expect(zonedToUtc(2026, 7, 14, 3, 0, 0, "America/Phoenix")?.toISOString()).toBe("2026-07-14T10:00:00.000Z");
    expect(zonedToUtc(2026, 7, 1, 12, 0, 0, "Europe/Berlin")?.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(zonedToUtc(2026, 1, 1, 12, 0, 0, "Europe/Berlin")?.toISOString()).toBe("2026-01-01T11:00:00.000Z");
    expect(zonedToUtc(2026, 1, 1, 12, 0, 0, "Not/AZone")).toBeNull();
  });
  it("reads dates, UTC and zoned times, and refuses nonsense", () => {
    expect(parseWhen("20260918", {})?.allDay).toBe(true);
    expect(parseWhen("20260918T100000Z", {})?.date.toISOString()).toBe("2026-09-18T10:00:00.000Z");
    expect(parseWhen("garbage", {})).toBeNull();
  });
  it("splits a description without machine part and survives broken JSON", () => {
    expect(splitDescription("<html-blob>Hello &amp; welcome<br>again").text).toBe("Hello & welcome\nagain");
    expect(splitDescription("Hi||EVENT_INFO||{broken").info).toEqual({});
  });
  it("survives hostile input", () => {
    expect(() => parseCalendar("BEGIN:VEVENT\r\nDTSTART:zzz\r\nSUMMARY:x\r\nEND:VEVENT\r\n".repeat(50), day("2026-01-01"), day("2027-01-01"))).not.toThrow();
    const bomb = wrap(fight.replace("BYDAY=TU", "BYDAY=TU,WE,TH,FR,SA,SU,MO").replace("DTSTART;TZID=America/Phoenix:20260714T030000", "DTSTART;TZID=America/Phoenix:20000101T030000"));
    expect(parseCalendar(bomb, day("2000-01-01"), day("2100-01-01")).length).toBeLessThanOrEqual(200);
  });
});
