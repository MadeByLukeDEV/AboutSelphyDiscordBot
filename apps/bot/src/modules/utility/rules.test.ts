import { describe, expect, it } from "vitest";
import { chunkLines, dateAndAgo, helpLines, listMentions, stamp, toEntry, visibleTo, type CommandEntry } from "./rules";

describe("timestamps", () => {
  it("use Discord's syntax and cope with missing dates", () => {
    expect(stamp(new Date(1_700_000_000_000))).toBe("<t:1700000000:f>");
    expect(dateAndAgo(new Date(1_700_000_000_000))).toBe("<t:1700000000:D> (<t:1700000000:R>)");
    expect(stamp(null)).toBe("unknown");
    expect(dateAndAgo(undefined)).toBe("unknown");
  });
});

describe("listMentions", () => {
  it("shows the first ones and counts the rest", () => {
    expect(listMentions([], "@&")).toBe("none");
    expect(listMentions(["1", "2"], "@&")).toBe("<@&1> <@&2>");
    expect(listMentions(Array.from({ length: 20 }, (_, i) => String(i)), "#", 3)).toBe("<#0> <#1> <#2> +17 more");
  });
});

describe("/help", () => {
  const entries: CommandEntry[] = [
    { name: "tag", description: "Show a saved answer", subcommands: [], requires: null },
    { name: "warn", description: "Warn a member", subcommands: [], requires: "moderator" },
    { name: "modlog", description: "Set up the mod log", subcommands: ["channel", "off"], requires: "admin" },
  ];

  it("hides staff commands from members and admin commands from moderators", () => {
    expect(visibleTo(entries, null).map((e) => e.name)).toEqual(["tag"]);
    expect(visibleTo(entries, "moderator").map((e) => e.name)).toEqual(["tag", "warn"]);
    expect(visibleTo(entries, "admin").map((e) => e.name)).toEqual(["tag", "warn", "modlog"]);
  });

  it("lists sub-commands and escapes descriptions", () => {
    const lines = helpLines([{ name: "x", description: "Do *this* <@&1>", subcommands: ["a", "b"], requires: null }]);
    expect(lines[0]).toContain("(a, b)");
    expect(lines[0]).not.toMatch(/(?<!\\)<@&/);
    expect(lines[0]).toContain("\\*this\\*");
  });

  it("reads a command definition", () => {
    const e = toEntry({ name: "poll", description: "d", options: [{ type: 1, name: "start", description: "x" }, { type: 3, name: "q", description: "y" }] } as never, "moderator");
    expect(e).toEqual({ name: "poll", description: "d", subcommands: ["start"], requires: "moderator" });
  });

  it("chunks lines to fit embed fields", () => {
    const chunks = chunkLines(Array.from({ length: 30 }, () => "x".repeat(100)), 1000);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
    expect(chunks.join("\n").split("\n").length).toBe(30);
  });
});
