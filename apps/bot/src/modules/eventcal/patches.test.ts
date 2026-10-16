import { describe, expect, it } from "vitest";
import { findPatchLinks, parsePatchSummary, planPatches, plainExcerpt } from "./patches";

const LIST = "https://game.example/news/patch-notes";

describe("finding patch note links", () => {
  const html = `<body>
    <a href="/news/patch-notes/update-1-2">Update 1.2: new islands</a>
    <a href="https://game.example/news/hotfix-1-1-1?utm=1#top">Hotfix 1.1.1 is live</a>
    <a href="/news/patch-notes">Patch notes</a>
    <a href="https://other.example/news/patch-9">Patch 9 on another site</a>
    <a href="/shop/hats">Buy hats now</a>
    <a href="/about">About</a>
    <a href="javascript:void(0)">Update later</a>
    <a href="/news/update-1-2">Update 1.2: new islands</a>
    <a href="/news/patch-notes/update-1-2">duplicate</a>
  </body>`;
  it("keeps same-site patch-like links once, in page order", () => {
    const links = findPatchLinks(html, LIST);
    expect(links.map((l) => l.url)).toEqual([
      "https://game.example/news/patch-notes/update-1-2",
      "https://game.example/news/hotfix-1-1-1?utm=1",
      "https://game.example/news/update-1-2",
    ]);
    expect(links[0]!.title).toBe("Update 1.2: new islands");
  });
  it("copes with nonsense", () => {
    expect(findPatchLinks("<<<>>", "not a url")).toEqual([]);
    expect(findPatchLinks("", LIST)).toEqual([]);
  });
});

describe("planning what to announce", () => {
  const a = { url: "https://g/a", title: "A patch" };
  const b = { url: "https://g/b", title: "B patch" };
  const c = { url: "https://g/c", title: "C patch" };
  const d = { url: "https://g/d", title: "D patch" };
  it("announces nothing before the first look", () => {
    expect(planPatches([a, b], new Set(), false)).toEqual({ post: [], remember: [a, b] });
  });
  it("announces unseen ones oldest first", () => {
    expect(planPatches([a, b, c], new Set([c.url]), true)).toEqual({ post: [b, a], remember: [] });
  });
  it("caps the announcements and remembers the rest silently", () => {
    const r = planPatches([a, b, c, d], new Set(), true, 2);
    expect(r.post).toEqual([b, a]);
    expect(r.remember).toEqual([d, c]);
  });
  it("does nothing when everything is known", () => {
    expect(planPatches([a], new Set([a.url]), true)).toEqual({ post: [], remember: [] });
  });
});

describe("the model's summary", () => {
  it("accepts 1-5 bullets and drops duplicates", () => {
    expect(parsePatchSummary({ bullets: ["Fixed the crash", "fixed the crash", "New map"] })).toEqual(["Fixed the crash", "New map"]);
  });
  it("rejects anything else", () => {
    expect(parsePatchSummary({ bullets: [] })).toBeNull();
    expect(parsePatchSummary({ bullets: ["x"] })).toBeNull();
    expect(parsePatchSummary({ bullets: Array(6).fill("A long enough bullet") })).toBeNull();
    expect(parsePatchSummary("text")).toBeNull();
  });
});

describe("plain excerpt", () => {
  it("keeps short text and cuts long text at a sentence", () => {
    expect(plainExcerpt("Short.")).toBe("Short.");
    const long = `${"Word ".repeat(30)}ends here. ${"More ".repeat(80)}`;
    expect(plainExcerpt(long, 200).endsWith(".")).toBe(true);
    expect(plainExcerpt("x".repeat(500), 100).endsWith("…")).toBe(true);
  });
});
