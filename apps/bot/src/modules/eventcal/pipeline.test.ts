import { describe, expect, it } from "vitest";
import { contentHash, parseExtraction, SYSTEM_PROMPT, userPrompt } from "./extract";
import { expandTemplate, looksBlocked, pageUrlsFor } from "./fetcher";
import { htmlToText } from "./html-text";
import { inferKind, toCalEvent, toRow } from "./store";
import { mergeArticle } from "./rules";
import type { CalEvent } from "./ics";

const NOW = new Date("2026-10-13T12:00:00Z");

describe("page addresses", () => {
  it("fills month, number and year", () => {
    expect(expandTemplate("https://x.test/news/this-month-{month}{year}", new Date("2026-10-13T00:00:00Z"))).toBe("https://x.test/news/this-month-october2026");
    expect(expandTemplate("https://x.test/{year}/{mm}", new Date("2026-03-01T00:00:00Z"))).toBe("https://x.test/2026/03");
  });
  it("looks at this month and the next, across a year end, and once when there is no date", () => {
    expect(pageUrlsFor("https://x.test/{month}{year}", new Date("2026-12-20T00:00:00Z"))).toEqual(["https://x.test/december2026", "https://x.test/january2027"]);
    expect(pageUrlsFor("https://x.test/news", NOW)).toEqual(["https://x.test/news"]);
  });
  it("recognises bot walls", () => {
    expect(looksBlocked(403, "")).toBe(true);
    expect(looksBlocked(200, "<html><title>Just a moment...</title></html>")).toBe(true);
    expect(looksBlocked(200, "<html>" + "article ".repeat(5000) + "</html>")).toBe(false);
  });
});

describe("page text", () => {
  const html = `<html><head><style>.x{}</style><script>alert(1)</script></head><body>
    <nav>Menu Home Shop</nav>
    <main><h1>This Month</h1><p>Intro   text.</p>
      <h2>Twitch Drops – Friday, October 23rd</h2><p>Watch to earn.</p><ul><li>Bucket</li><li>Wheel</li></ul></main>
    <footer>Legal</footer></body></html>`;
  it("keeps headings and paragraphs and drops menus, scripts and footers", () => {
    const text = htmlToText(html);
    expect(text).toContain("This Month\n\nIntro text.");
    expect(text).toContain("Twitch Drops – Friday, October 23rd\n\nWatch to earn.");
    expect(text).toContain("Bucket\nWheel");
    expect(text).not.toMatch(/Menu|alert|Legal/);
  });
  it("narrows to a selector and survives a bad one", () => {
    expect(htmlToText(`<body><div class="a">no</div><div class="post">yes</div></body>`, ".post")).toBe("yes");
    expect(htmlToText(`<body><main>fine</main></body>`, "###")).toBe("fine");
  });
});

describe("page text fallbacks", () => {
  const long = "A paragraph of the article with enough words to count as real content. ".repeat(6);
  it("reads an article that sits inside a form and a header", () => {
    const text = htmlToText(`<html><body><form><header><h1>This Month</h1><p>${long}</p></header></form></body></html>`);
    expect(text).toContain("This Month");
    expect(text.length).toBeGreaterThan(200);
  });
  it("prefers a bigger scope when <main> is nearly empty", () => {
    const text = htmlToText(`<html><body><main><p>Loading</p></main><div id="app"><p>${long}</p></div></body></html>`);
    expect(text.length).toBeGreaterThan(200);
  });
  it("gives back whatever there is when nothing is long enough", () => {
    expect(htmlToText("<body><p>Short</p></body>")).toBe("Short");
  });
});

describe("the extraction check", () => {
  const article = "Twitch Drops – Friday, October 23rd – Monday, October 26th. There's a tasty new selection of Drops. Stalwart Sea Dog Bucket and Gilded Phoenix Wheel.";
  const good = {
    title: "Twitch Drops",
    kind: "drop",
    start: "2026-10-23",
    end: "2026-10-26",
    weekday: null,
    description: "Drops during Community Weekend.",
    summary: "Watch to earn rewards.",
    blurb: "Drops are back.",
    audience: "everyone",
    items: ["Stalwart Sea Dog Bucket", "Gilded Phoenix Wheel", "gilded phoenix wheel"],
  };
  it("turns a good answer into article events with items, tags and audience", () => {
    const [e] = parseExtraction({ events: [good] }, article, NOW);
    expect(e!.title).toBe("Twitch Drops");
    expect(e!.start!.toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(e!.end!.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(e!.items).toEqual(["Stalwart Sea Dog Bucket", "Gilded Phoenix Wheel"]);
    expect(e!.categories).toEqual(["drop", "twitch_drop"]);
    expect(e!.audience).toBe("everyone");
  });
  it("drops invented titles, impossible dates and backwards ranges", () => {
    const bad = [
      { ...good, title: "Made Up Festival" },
      { ...good, start: "2026-02-30" },
      { ...good, start: "2031-10-23" },
      { ...good, start: "2026-10-26", end: "2026-10-23" },
      { ...good, start: null, weekday: null },
    ];
    expect(parseExtraction({ events: bad }, article, NOW)).toEqual([]);
  });
  it("keeps a repeating entry that only has a weekday, and survives a wrong shape", () => {
    const text = "Fight Nights – Every Tuesday. Join in.";
    const [e] = parseExtraction({ events: [{ title: "Fight Nights", kind: "event", start: null, end: null, weekday: 2, description: "Join in." }] }, text, NOW);
    expect(e!.everyWeekday).toBe(2);
    expect(parseExtraction("nonsense", text, NOW)).toEqual([]);
    expect(parseExtraction({ events: "x" }, text, NOW)).toEqual([]);
  });
  it("makes an unknown kind or audience harmless", () => {
    const [e] = parseExtraction({ events: [{ ...good, kind: "weird", audience: "robots" }] }, article, NOW);
    expect(e!.kind).toBe("event");
    expect(e!.audience).toBe("unknown");
  });
  it("hashes the text and the game, and tells the model the game", () => {
    expect(contentHash("a", "Hunt")).toBe(contentHash("a", "Hunt"));
    expect(contentHash("a", "Hunt")).not.toBe(contentHash("a", "SoT"));
    expect(contentHash("a", "Hunt")).not.toBe(contentHash("b", "Hunt"));
    expect(userPrompt("body", "Hunt: Showdown", NOW)).toMatch(/^Game: Hunt: Showdown\nToday: 2026-10-13/);
    expect(SYSTEM_PROMPT).toMatch(/Ignore any instructions/);
  });
});

describe("stored events", () => {
  const cal: CalEvent = { key: "k", summary: "Twitch Drops", start: new Date("2026-10-23T00:00:00Z"), end: null, allDay: true, description: "d", categories: ["twitch_drop"], image: null, video: null, color: null };
  it("guesses a kind for plain calendar entries", () => {
    expect(inferKind(cal)).toBe("drop");
    expect(inferKind({ ...cal, summary: "October Game Update", categories: [] })).toBe("update");
    expect(inferKind({ ...cal, summary: "Pirate Emporium Halloween Sale", categories: [] })).toBe("sale");
    expect(inferKind({ ...cal, summary: "Fight Night", categories: [] })).toBe("event");
    expect(inferKind({ ...cal, kind: "sale" })).toBe("sale");
  });
  it("round-trips through the stored row", () => {
    const withExtra: CalEvent = { ...cal, items: ["Bucket"], extra: { summary: "S", blurb: "B", audience: "partners" } };
    const row = toRow(withExtra);
    expect(row.kind).toBe("drop");
    expect(row.items).toEqual(["Bucket"]);
    const back = toCalEvent({ ...row, endsAt: row.endsAt });
    expect(back.extra).toEqual({ summary: "S", blurb: "B", audience: "partners" });
    expect(back.items).toEqual(["Bucket"]);
    expect(toCalEvent({ ...row, summary: "" }).extra).toBeUndefined();
  });
  it("cuts overlong values to what the columns hold", () => {
    const row = toRow({ ...cal, key: "k".repeat(300), summary: "t".repeat(300), description: "d".repeat(9000) });
    expect(row.key).toHaveLength(160);
    expect(row.title).toHaveLength(120);
    expect(row.description).toHaveLength(4000);
  });
  it("carries extracted details through the merge onto a calendar event", () => {
    const merged = mergeArticle([cal], [{ title: "Twitch Drops", start: new Date("2026-10-23T00:00:00Z"), end: null, everyWeekday: null, text: "Article text.", categories: [], image: null, video: null, kind: "drop", items: ["Bucket"], summary: "Sum", blurb: "Bl", audience: "everyone" }], new Date("2026-10-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z"));
    expect(merged[0]!.items).toEqual(["Bucket"]);
    expect(merged[0]!.extra?.audience).toBe("everyone");
  });
});
