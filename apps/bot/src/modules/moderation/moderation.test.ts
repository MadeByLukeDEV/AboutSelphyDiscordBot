import { describe, expect, it } from "vitest";
import { escapeText, truncate } from "../../lib/escape";
import { formatDuration, MAX_TIMEOUT_SECONDS, parseDuration } from "./duration";
import { buildCaseEmbed, memberLine, type CaseView } from "./embed";
import { checkHierarchy, type HierarchyInput } from "./hierarchy";

describe("parseDuration", () => {
  it("parses single units", () => {
    expect(parseDuration("30s")).toBe(30);
    expect(parseDuration("10m")).toBe(600);
    expect(parseDuration("2h")).toBe(7200);
    expect(parseDuration("7d")).toBe(604_800);
    expect(parseDuration("1w")).toBe(604_800);
  });
  it("parses combinations, case and spaces", () => {
    expect(parseDuration("1d12h")).toBe(129_600);
    expect(parseDuration(" 1D 12H 5m ")).toBe(129_900);
  });
  it("rejects garbage", () => {
    for (const bad of ["", "abc", "10", "m10", "0m", "-5m", "1.5h", "10x", "1d garbage", "99999999d"]) {
      expect(parseDuration(bad), bad).toBeNull();
    }
  });
  it("lets the caller compare against Discord's 28 day limit", () => {
    expect(parseDuration("28d")).toBe(MAX_TIMEOUT_SECONDS);
    expect(parseDuration("29d")! > MAX_TIMEOUT_SECONDS).toBe(true);
  });
});

describe("formatDuration", () => {
  it("formats", () => {
    expect(formatDuration(129_900)).toBe("1d 12h 5m");
    expect(formatDuration(604_800)).toBe("1w");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(0)).toBe("0s");
  });
});

const base: HierarchyInput = {
  actorId: "1",
  targetId: "2",
  botId: "3",
  ownerId: "4",
  actorPosition: 10,
  targetPosition: 5,
  botPosition: 20,
};

describe("checkHierarchy", () => {
  it("allows a lower target", () => {
    expect(checkHierarchy(base)).toEqual({ ok: true });
  });
  it("blocks self, the bot and the owner", () => {
    expect(checkHierarchy({ ...base, targetId: "1" })).toEqual({ ok: false, reason: "self" });
    expect(checkHierarchy({ ...base, targetId: "3" })).toEqual({ ok: false, reason: "bot" });
    expect(checkHierarchy({ ...base, targetId: "4" })).toEqual({ ok: false, reason: "owner" });
  });
  it("blocks equal or higher targets for the moderator", () => {
    expect(checkHierarchy({ ...base, targetPosition: 10 })).toEqual({ ok: false, reason: "actor_hierarchy" });
    expect(checkHierarchy({ ...base, targetPosition: 11 })).toEqual({ ok: false, reason: "actor_hierarchy" });
  });
  it("blocks targets the bot can't reach", () => {
    expect(checkHierarchy({ ...base, actorPosition: 30, targetPosition: 25 })).toEqual({
      ok: false,
      reason: "bot_hierarchy",
    });
  });
  it("lets the owner act on anyone below the bot, but never past the bot", () => {
    const asOwner = { ...base, actorId: "4", actorPosition: 0 };
    expect(checkHierarchy({ ...asOwner, targetPosition: 19 })).toEqual({ ok: true });
    expect(checkHierarchy({ ...asOwner, targetPosition: 20 })).toEqual({ ok: false, reason: "bot_hierarchy" });
  });
  it("skips role checks for users who aren't in the server", () => {
    expect(checkHierarchy({ ...base, targetPosition: null })).toEqual({ ok: true });
    expect(checkHierarchy({ ...base, targetPosition: null, targetId: "1" })).toEqual({ ok: false, reason: "self" });
  });
});

describe("escapeText", () => {
  it("defuses mentions, timestamps, markdown and links", () => {
    const out = escapeText("<@123> <#456> <@&789> <t:1:F> **bold** https://evil.example");
    expect(out).not.toMatch(/(^|[^\\])</);
    expect(out).toContain("\\*\\*bold\\*\\*");
    expect(out).toContain("https\\://evil.example");
  });
  it("collapses whitespace", () => {
    expect(escapeText("a \n\n  b")).toBe("a b");
  });
});

describe("truncate", () => {
  it("cuts by characters, not UTF-16 units", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("ab", 4)).toBe("ab");
    expect(truncate("😀😀😀😀", 3)).toBe("😀😀…");
  });
});

const sample: CaseView = {
  caseNumber: 12,
  type: "timeout",
  source: "command",
  targetId: "111111111111111111",
  targetName: "Some*One",
  moderatorId: "222222222222222222",
  moderatorName: "Mod",
  reason: "spam <@&333333333333333333> https://x.example",
  durationSeconds: 3600,
  expiresAt: new Date("2026-10-09T12:00:00Z"),
  active: true,
  createdAt: new Date("2026-10-09T11:00:00Z"),
};

describe("buildCaseEmbed", () => {
  it("renders the case and escapes user text", () => {
    const json = buildCaseEmbed(sample).toJSON();
    expect(json.title).toBe("Case #12 · Timeout");
    const text = JSON.stringify(json);
    expect(text).toContain("<@111111111111111111>");
    expect(text).toContain("Some\\\\*One");
    expect(text).not.toContain("<@&333333333333333333>");
    expect(text).toContain("1h");
    expect(text).toContain("<t:1791547200:f>");
  });
  it("marks pardoned warnings and automatic rules", () => {
    const warn = buildCaseEmbed({ ...sample, type: "warn", active: false, durationSeconds: null, expiresAt: null }).toJSON();
    expect(warn.title).toContain("(pardoned)");
    expect(memberLine("system", null)).toBe("Automatic rule");
  });
  it("stays within Discord's field limits for a huge reason", () => {
    const json = buildCaseEmbed({ ...sample, reason: "x".repeat(5000) }).toJSON();
    for (const f of json.fields ?? []) expect(f.value.length).toBeLessThanOrEqual(1024);
  });
});
