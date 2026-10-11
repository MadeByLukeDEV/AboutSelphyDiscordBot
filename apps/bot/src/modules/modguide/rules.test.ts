import { describe, expect, it } from "vitest";
import { buildCategories, buildGuidePages, isModeratorCommand, usageOf, type GuideCommand } from "./rules";

const cmd = (name: string, description: string, options: unknown[] = [], requires?: "admin" | "moderator"): GuideCommand => ({ data: { name, description, options } as GuideCommand["data"], requires });

describe("usageOf", () => {
  it("marks required options with <> and optional ones with []", () => {
    expect(usageOf(cmd("ban", "x", [{ type: 6, name: "user", required: true }, { type: 3, name: "duration" }]).data)).toBe("/ban <user> [duration]");
  });
  it("lists sub-commands", () => {
    expect(usageOf(cmd("suggestion", "x", [{ type: 1, name: "approve" }, { type: 1, name: "deny" }]).data)).toBe("/suggestion approve|deny");
  });
  it("is just the name without options", () => {
    expect(usageOf(cmd("lock", "x").data)).toBe("/lock");
  });
});

describe("which commands are listed", () => {
  it("only moderator commands (plus ticket), never admin, everyone's or ping", () => {
    expect(isModeratorCommand(cmd("warn", "x", [], "moderator"))).toBe(true);
    expect(isModeratorCommand(cmd("ticket", "x"))).toBe(true);
    expect(isModeratorCommand(cmd("modlog", "x", [], "admin"))).toBe(false);
    expect(isModeratorCommand(cmd("rank", "x"))).toBe(false);
    expect(isModeratorCommand(cmd("ping", "x", [], "moderator"))).toBe(false);
  });

  it("groups by category in a fixed order and puts unknown commands under Other", () => {
    const cats = buildCategories([cmd("purge", "p", [], "moderator"), cmd("warn", "w", [], "moderator"), cmd("zzz", "z", [], "moderator"), cmd("rank", "r")]);
    expect(cats.map((c) => c.title)).toEqual(["Acting on members", "Channel tools", "Other"]);
    expect(cats[2]!.lines[0]).toContain("/zzz");
  });

  it("escapes descriptions", () => {
    const [cat] = buildCategories([cmd("warn", "@everyone *bold* <@1>", [], "moderator")]);
    // Markdown and mention syntax are made inert (and the message allows no mentions at all).
    expect(cat!.lines[0]).toContain(String.raw`\*bold\*`);
    expect(cat!.lines[0]).not.toContain("<@1>");
  });
});

describe("pages", () => {
  const text = { title: "Guide", description: "Hello", imageUrl: "https://example.com/c.png", color: "#00FFA8", notes: "" };

  it("puts the cover picture on the first embed only", () => {
    const [page] = buildGuidePages(text, [{ title: "A", lines: ["x"] }]);
    expect(page![0]!.image?.url).toBe("https://example.com/c.png");
    expect(page![1]!.image).toBeUndefined();
  });

  it("ignores a picture that isn't https", () => {
    const [page] = buildGuidePages({ ...text, imageUrl: "http://example.com/c.png" }, []);
    expect(page![0]!.image).toBeUndefined();
  });

  it("keeps every message within Discord's limits however long the list is", () => {
    const lines = Array.from({ length: 80 }, (_, i) => `**\`/c${i}\`**\n${"d".repeat(110)}`);
    const pages = buildGuidePages({ ...text, notes: "n".repeat(1500) }, [{ title: "Big", lines }, { title: "More", lines }]);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(10);
      const total = page.reduce((n, e) => n + (e.title?.length ?? 0) + (e.description?.length ?? 0), 0);
      expect(total).toBeLessThanOrEqual(6000);
      for (const e of page) expect((e.description ?? "").length).toBeLessThanOrEqual(4096);
    }
  });

  it("falls back to the default colour for a bad value", () => {
    const [page] = buildGuidePages({ ...text, color: "red" }, []);
    expect(page![0]!.color).toBe(0x00ffa8);
  });
});
