import { describe, expect, it } from "vitest";
import { parseOptions, pollInput } from "@aboutselphy/shared/polls";
import { bar, buildPollMessage, nextSelection, parseVoteControl, tally, voteControlId, type PollView } from "./rules";

describe("parseOptions", () => {
  it("splits on bars, semicolons and new lines, trims, and drops blanks and repeats", () => {
    expect(parseOptions("Pizza | Pasta;  Salad\nsalad |  | PIZZA")).toEqual(["Pizza", "Pasta", "Salad"]);
    expect(parseOptions("")).toEqual([]);
    expect(parseOptions("one")).toEqual(["one"]);
  });
});

describe("pollInput", () => {
  const base = { channelId: "123456789012345678", question: "Lunch?", options: ["A", "B"], multiple: false, endsAt: "" };
  const parse = (over: Record<string, unknown>) => pollInput.safeParse({ ...base, ...over });

  it("takes 2 to 10 different options and an optional end", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ options: ["A"] }).success).toBe(false);
    expect(parse({ options: Array.from({ length: 11 }, (_, i) => `o${i}`) }).success).toBe(false);
    expect(parse({ options: ["A", "a"] }).success).toBe(false);
    expect(parse({ options: ["A", "x".repeat(81)] }).success).toBe(false);
    expect(parse({ endsAt: new Date(Date.now() + 3_600_000).toISOString() }).success).toBe(true);
    expect(parse({ endsAt: new Date(Date.now() + 5000).toISOString() }).success).toBe(false);
    expect(parse({ endsAt: "soon" }).success).toBe(false);
    expect(parse({ question: " " }).success).toBe(false);
  });
});

describe("nextSelection", () => {
  it("single choice replaces, and pressing the chosen option withdraws it", () => {
    expect([...nextSelection(new Set(), 2, false)]).toEqual([2]);
    expect([...nextSelection(new Set([2]), 4, false)]).toEqual([4]);
    expect([...nextSelection(new Set([2]), 2, false)]).toEqual([]);
  });

  it("multiple choice toggles just that option", () => {
    expect([...nextSelection(new Set([1]), 3, true)].sort()).toEqual([1, 3]);
    expect([...nextSelection(new Set([1, 3]), 1, true)]).toEqual([3]);
  });

  it("does not modify its input", () => {
    const current = new Set([1]);
    nextSelection(current, 2, false);
    expect([...current]).toEqual([1]);
  });
});

describe("tally and bar", () => {
  it("counts votes per option and ignores out-of-range ones", () => {
    expect(tally(3, [{ optionIndex: 0 }, { optionIndex: 0 }, { optionIndex: 2 }, { optionIndex: 7 }])).toEqual([2, 0, 1]);
  });

  it("draws a bar of a fixed width", () => {
    expect(bar(0, 0)).toBe("░".repeat(12));
    expect(bar(5, 10)).toBe("██████░░░░░░");
    expect(bar(10, 10)).toBe("█".repeat(12));
  });
});

describe("control ids", () => {
  it("round-trips and rejects anything else", () => {
    expect(parseVoteControl(voteControlId("cm1abc2def3ghi", 3))).toEqual({ id: "cm1abc2def3ghi", index: 3 });
    for (const bad of ["pl:v:cm1abc2def3ghi:10", "pl:v:cm1abc2def3ghi:a", "pl:v:short:1", "pl:x:cm1abc2def3ghi:1", "gw:enter:cm1abc2def3ghi", "pl:v:CM1ABC2DEF3GHI:1"]) {
      expect(parseVoteControl(bad), bad).toBeNull();
    }
  });
});

describe("the picture", () => {
  const base = { id: "cm1abc2def3ghi", question: "Q?", options: ["A", "B"], multiple: false, endsAt: null, ended: false, counts: [0, 0], voters: 0, createdByName: "x" };
  it("shows an https picture and ignores anything else", () => {
    expect(buildPollMessage({ ...base, imageUrl: "https://cdn.example.com/a.png" }).embeds[0]!.toJSON().image?.url).toBe("https://cdn.example.com/a.png");
    for (const bad of ["http://x.example/a.png", "javascript:alert(1)", "https://a b.example/x"]) expect(buildPollMessage({ ...base, imageUrl: bad }).embeds[0]!.toJSON().image).toBeUndefined();
    expect(buildPollMessage(base).embeds[0]!.toJSON().image).toBeUndefined();
  });
});

describe("the message", () => {
  const view = (over: Partial<PollView> = {}): PollView => ({
    id: "cm1abc2def3ghi",
    question: "Best **food** <@&999999999999999999>?",
    options: ["Pizza", "Pasta", "Salad"],
    multiple: false,
    endsAt: null,
    ended: false,
    counts: [3, 1, 0],
    voters: 4,
    createdByName: "Selphy",
    ...over,
  });
  const text = (m: ReturnType<typeof buildPollMessage>) => JSON.stringify(m.embeds[0]!.toJSON());

  it("escapes the question, pings nobody and shows counts and percentages", () => {
    const m = buildPollMessage(view());
    expect(text(m)).toContain("\\\\*\\\\*food\\\\*\\\\*");
    expect(text(m)).not.toMatch(/(?<!\\\\)<@&99/);
    expect(text(m)).toContain("3 (75%)");
    expect(text(m)).toContain("4 voters");
    expect(m.allowedMentions).toEqual({ parse: [] });
  });

  it("lays buttons out five to a row and disables them once ended, marking the winner", () => {
    const options = Array.from({ length: 7 }, (_, i) => `Option ${i + 1}`);
    const live = buildPollMessage(view({ options, counts: new Array(7).fill(0), voters: 0 }));
    expect(live.components.map((r) => r.components.length)).toEqual([5, 2]);
    const ended = buildPollMessage(view({ ended: true }));
    expect(text(ended)).toContain("🏆");
    expect(text(ended)).toContain("has ended");
    expect((ended.components[0]!.toJSON().components as Array<{ disabled?: boolean }>).every((b) => b.disabled)).toBe(true);
  });

  it("marks no winner when nobody voted", () => {
    expect(text(buildPollMessage(view({ ended: true, counts: [0, 0, 0], voters: 0 })))).not.toContain("🏆");
  });
});
