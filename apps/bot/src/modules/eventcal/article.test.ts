import { describe, expect, it } from "vitest";
import { articleYear, classifyMedia, parseArticle } from "@aboutselphy/shared/eventcal-article";

const ARTICLE = `This Month in Sea of Thieves: October 2026
Find out about the seafaring shenanigans currently planned for the month ahead!
Posted in: Announcements on 06 Oct 2026

The nights are drawing in, so let's get right to it.

Sea of Thieves Sail Design Competition – Until Friday, October 23rd

Budding shipwrights should be reaching for their pencils.

You can find a template image in our dedicated article.

Fight Nights – Every Tuesday

Each Tuesday both Factions offer increased Allegiance.

‘Maiden Voyage (Bard’s Mix)’ Release – Friday, October 9th

Medieval music lovers are in for a treat.

Bilge Rats Weekender – Friday, October 16th – Monday, October 19th

The next Bilge Rats Weekender will be landing in the middle of the month.

As before, the Weekender will showcase a returning Event.

October Game Update – Thursday, October 22nd

The next monthly update is due to dock.

Outfit Saving and Talk Like a Pirate Day: Sea of Thieves News
Duration 13:40

Twitch Drops – Friday, October 23rd – Monday, October 26th

There's a tasty new selection of Drops: the Stalwart Sea Dog Bucket and the Gilded Phoenix Wheel.

Festival of the Damned – Tuesday, October 27th – Tuesday, November 3rd

Spine-chilling celebrations continue.

Pirate Emporium Halloween Sale – Wednesday, October 28th – Tuesday, November 3rd

Some of the scariest stock has been selected for inclusion.

And all that finally brings us to the end of the month. We hope you enjoy all the treats – and tricks! – planned for October.
`;

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("parseArticle", () => {
  const events = parseArticle(ARTICLE);
  const byTitle = (t: string) => events.find((e) => e.title === t)!;

  it("finds every section and nothing else", () => {
    expect(events.map((e) => e.title)).toEqual([
      "Sea of Thieves Sail Design Competition",
      "Fight Nights",
      "‘Maiden Voyage (Bard’s Mix)’ Release",
      "Bilge Rats Weekender",
      "October Game Update",
      "Twitch Drops",
      "Festival of the Damned",
      "Pirate Emporium Halloween Sale",
    ]);
  });
  it("reads single days, ranges, 'until' and ranges into the next month", () => {
    expect(byTitle("October Game Update").start).toEqual(day("2026-10-22"));
    expect(byTitle("October Game Update").end).toBeNull();
    expect(byTitle("Twitch Drops").start).toEqual(day("2026-10-23"));
    expect(byTitle("Twitch Drops").end).toEqual(day("2026-10-26"));
    expect(byTitle("Festival of the Damned").end).toEqual(day("2026-11-03"));
    expect(byTitle("Sea of Thieves Sail Design Competition").start).toEqual(day("2026-10-23"));
  });
  it("marks repeating entries by weekday instead of a date", () => {
    expect(byTitle("Fight Nights")).toMatchObject({ start: null, everyWeekday: 2 });
  });
  it("keeps the paragraphs of a section and drops captions and the sign-off", () => {
    expect(byTitle("Bilge Rats Weekender").text).toBe("The next Bilge Rats Weekender will be landing in the middle of the month.\n\nAs before, the Weekender will showcase a returning Event.");
    expect(byTitle("October Game Update").text).toBe("The next monthly update is due to dock.");
    expect(byTitle("Pirate Emporium Halloween Sale").text).toBe("Some of the scariest stock has been selected for inclusion.");
  });
  it("tags Twitch Drops", () => {
    expect(byTitle("Twitch Drops").categories).toEqual(["twitch_drop"]);
    expect(byTitle("Fight Nights").categories).toEqual([]);
  });
});

describe("year and bad input", () => {
  it("takes the year from the byline or the title", () => {
    expect(articleYear("Posted in: Announcements on 06 Oct 2026")).toBe(2026);
    expect(articleYear("This Month: October 2026")).toBe(2026);
    expect(articleYear("nothing here")).toBeNull();
  });
  it("returns nothing without a year, for empty text, or for impossible dates", () => {
    expect(parseArticle("Twitch Drops – Friday, October 23rd\n\nText")).toEqual([]);
    expect(parseArticle("")).toEqual([]);
    expect(parseArticle("Twitch Drops – Friday, February 31st\n\nText", 2026)).toEqual([]);
  });
  it("lets a range run into the next year", () => {
    const [e] = parseArticle("Winter Event – December 30th – January 2nd\n\nSnow.", 2026);
    expect(e!.start).toEqual(day("2026-12-30"));
    expect(e!.end).toEqual(day("2027-01-02"));
  });
  it("survives huge or odd input", () => {
    expect(() => parseArticle("x – y\n\n".repeat(5000), 2026)).not.toThrow();
  });
});

describe("pictures and videos in an article", () => {
  const text = `Posted in: Announcements on 06 Oct 2026

October Game Update – Thursday, October 22nd

The next monthly update is due to dock.

https://www.youtube.com/watch?v=l-gDZD1_jiw

https://assets.example.com/update/banner.png?w=800

https://unknown.example/page

Twitch Drops – Friday, October 23rd – Monday, October 26th

Drops text.

https://evil.example/not-an-image
`;
  const events = parseArticle(text);
  it("attaches a video link and a picture to their section", () => {
    expect(events[0]!.video).toBe("https://www.youtube.com/watch?v=l-gDZD1_jiw");
    expect(events[0]!.image).toBe("https://assets.example.com/update/banner.png?w=800");
  });
  it("keeps links out of the text and ignores links that are neither", () => {
    expect(events[0]!.text).toBe("The next monthly update is due to dock.");
    expect(events[1]).toMatchObject({ image: null, video: null, text: "Drops text." });
  });
  it("only accepts https pictures and known video sites", () => {
    expect(classifyMedia("https://youtu.be/abc123")).toBe("video");
    expect(classifyMedia("https://www.twitch.tv/videos/123456")).toBe("video");
    expect(classifyMedia("https://example.com/a.JPG")).toBe("image");
    expect(classifyMedia("http://example.com/a.png")).toBeNull();
    expect(classifyMedia("https://example.com/watch?v=1")).toBeNull();
    expect(classifyMedia("javascript:alert(1)")).toBeNull();
  });
});
