import { describe, expect, it } from "vitest";
import { feedInput, isFeedUrlSyntax } from "@aboutselphy/shared/feeds";
import { parseFeed, type FeedItemData } from "./parse";
import { isDue, MAX_POSTS_PER_CHECK, renderFeedMessage, safeLink, selectNew } from "./rules";

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
<item><title>Second video</title><link>https://example.com/v/2</link><guid isPermaLink="false">id-2</guid><pubDate>Mon, 05 Oct 2026 12:00:00 GMT</pubDate></item>
<item><title>First &amp; best</title><link>https://example.com/v/1</link><pubDate>Sun, 04 Oct 2026 12:00:00 GMT</pubDate></item>
<item><description>no title or link or id</description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>x</title>
<entry><title>An entry</title><id>tag:example.com,2026:1</id><link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/e/1"/><updated>2026-10-05T12:00:00Z</updated></entry>
<entry><title type="html">Another</title><link href="https://example.com/e/2"/></entry></feed>`;

describe("parseFeed", () => {
  it("reads RSS items, decodes entities and skips items with nothing to identify them", () => {
    const items = parseFeed(RSS);
    expect(items.map((i) => i.guid)).toEqual(["id-2", "https://example.com/v/1"]);
    expect(items[1]!.title).toBe("First & best");
    expect(items[0]!.publishedAt?.toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });

  it("reads Atom entries and prefers the alternate link", () => {
    const items = parseFeed(ATOM);
    expect(items[0]).toMatchObject({ guid: "tag:example.com,2026:1", link: "https://example.com/e/1", title: "An entry" });
    expect(items[1]!.guid).toBe("https://example.com/e/2");
    expect(items[1]!.publishedAt).toBeNull();
  });

  it("refuses things that aren't feeds and survives hostile input", () => {
    expect(() => parseFeed("<html><body>hi</body></html>")).toThrow();
    expect(() => parseFeed("not xml at all")).toThrow();
    expect(() => parseFeed('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><rss><channel><item><title>&b;&b;</title><link>https://e.com</link></item></channel></rss>')).not.toThrow();
  });

  it("caps long fields and the number of items", () => {
    const many = `<rss><channel>${Array.from({ length: 80 }, (_, i) => `<item><title>${"t".repeat(1000)}</title><guid>g${i}</guid></item>`).join("")}</channel></rss>`;
    const items = parseFeed(many);
    expect(items).toHaveLength(50);
    expect(items[0]!.title.length).toBe(300);
  });
});

describe("selectNew", () => {
  const now = new Date("2026-10-05T13:00:00Z");
  const item = (guid: string, hoursAgo: number | null): FeedItemData => ({ guid, title: guid, link: `https://e.com/${guid}`, publishedAt: hoursAgo === null ? null : new Date(now.getTime() - hoursAgo * 3_600_000) });

  it("announces unseen fresh items, oldest first", () => {
    const sel = selectNew([item("c", 1), item("b", 2), item("a", 3)], new Set(), now);
    expect(sel.toPost.map((i) => i.guid)).toEqual(["a", "b", "c"]);
    expect(sel.toRemember).toEqual([]);
  });

  it("skips what was seen and only remembers old items", () => {
    const sel = selectNew([item("new", 1), item("seen", 2), item("old", 100)], new Set(["seen"]), now);
    expect(sel.toPost.map((i) => i.guid)).toEqual(["new"]);
    expect(sel.toRemember.map((i) => i.guid)).toEqual(["old"]);
  });

  it("never floods: at most five are announced, the rest are remembered", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`g${i}`, i + 1));
    const sel = selectNew(items, new Set(), now);
    expect(sel.toPost).toHaveLength(MAX_POSTS_PER_CHECK);
    expect(sel.toPost.map((i) => i.guid)).toEqual(["g4", "g3", "g2", "g1", "g0"]); // the newest five, oldest first
    expect(sel.toRemember).toHaveLength(7);
  });

  it("treats a missing date as fresh and keeps the feed's order reversed", () => {
    const sel = selectNew([item("newest", null), item("older", null)], new Set(), now);
    expect(sel.toPost.map((i) => i.guid)).toEqual(["older", "newest"]);
  });
});

describe("renderFeedMessage", () => {
  it("escapes names and titles, keeps a clean link and pings nobody", () => {
    const text = renderFeedMessage("{name}: {title} {link} @everyone <@&99>", { name: "Tik*Tok", title: "New **video** <@&99999999999999999>", link: "https://example.com/v/1" });
    expect(text).toContain("Tik\\*Tok");
    expect(text).toContain("https://example.com/v/1");
    expect(text).not.toMatch(/(?<!\\)<@&/);
    expect(text).not.toMatch(/(?<!\\)\*\*video/);
  });

  it("drops a link that isn't http(s) or has odd characters", () => {
    expect(safeLink("javascript:alert(1)")).toBe("");
    expect(safeLink("https://e.com/a b")).toBe("");
    expect(safeLink("https://e.com/a>x")).toBe("");
    expect(safeLink("http://e.com/a")).toBe("http://e.com/a");
    expect(renderFeedMessage("{title} {link}", { name: "n", title: "t", link: "javascript:x" })).toBe("t");
  });

  it("stays within Discord's limit", () => expect(renderFeedMessage("{title}".repeat(200), { name: "n", title: "x".repeat(300), link: "" }).length).toBeLessThanOrEqual(1900));
});

describe("isDue", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  it("is due when never checked or the interval has passed", () => {
    expect(isDue({ lastCheckedAt: null, intervalMinutes: 10 }, now)).toBe(true);
    expect(isDue({ lastCheckedAt: new Date("2026-10-05T11:49:00Z"), intervalMinutes: 10 }, now)).toBe(true);
    expect(isDue({ lastCheckedAt: new Date("2026-10-05T11:55:00Z"), intervalMinutes: 10 }, now)).toBe(false);
  });
});

describe("feed input", () => {
  const base = { name: "TikTok", url: "https://rsshub.example.com/tiktok/user/@x", channelId: "123456789012345678", pingRoleId: "", messageTemplate: "{title} {link}", intervalMinutes: 10, enabled: true };
  it("validates the fields", () => {
    expect(feedInput.safeParse(base).success).toBe(true);
    expect(feedInput.safeParse({ ...base, url: "" }).success).toBe(false);
    expect(feedInput.safeParse({ ...base, url: "", id: "abc" }).success).toBe(true);
    expect(feedInput.safeParse({ ...base, intervalMinutes: 4 }).success).toBe(false);
    expect(feedInput.safeParse({ ...base, intervalMinutes: 1441 }).success).toBe(false);
    expect(feedInput.safeParse({ ...base, url: "ftp://x.com/a" }).success).toBe(false);
    expect(feedInput.safeParse({ ...base, url: "https://user:pw@x.com/a" }).success).toBe(false);
    expect(feedInput.safeParse({ ...base, channelId: "general" }).success).toBe(false);
  });
  it("accepts http and https addresses only, without spaces or credentials", () => {
    expect(isFeedUrlSyntax("http://rsshub:1200/tiktok/user/@x")).toBe(true);
    expect(isFeedUrlSyntax("https://a.com/x?key=1")).toBe(true);
    for (const bad of ["", "a.com/x", "javascript:alert(1)", "https://a.com/a b", "https://u:p@a.com/x"]) expect(isFeedUrlSyntax(bad), bad).toBe(false);
  });
});
