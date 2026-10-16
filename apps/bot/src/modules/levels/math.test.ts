import { describe, expect, it } from "vitest";
import { applyBoost, boostPercent, eventBoost, fillLevelTemplate, levelFromXp, levelSettingsSchema, MAX_LEVEL, progressOf, totalXpForLevel, xpToNext } from "@aboutselphy/shared/levels";

describe("the level curve", () => {
  it("matches the MEE6 formula", () => {
    expect([0, 1, 2, 10].map(xpToNext)).toEqual([100, 155, 220, 1100]);
    expect([0, 1, 2, 3, 5].map(totalXpForLevel)).toEqual([0, 100, 255, 475, 1150]);
  });

  it("totalXpForLevel is the sum of the steps", () => {
    let sum = 0;
    for (let level = 0; level <= 60; level++) {
      expect(totalXpForLevel(level)).toBe(sum);
      sum += xpToNext(level);
    }
  });

  it("levelFromXp is the inverse at the boundaries", () => {
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(99)).toBe(0);
    expect(levelFromXp(100)).toBe(1);
    expect(levelFromXp(254)).toBe(1);
    expect(levelFromXp(255)).toBe(2);
    for (const level of [5, 20, 100]) {
      expect(levelFromXp(totalXpForLevel(level))).toBe(level);
      expect(levelFromXp(totalXpForLevel(level) - 1)).toBe(level - 1);
    }
    expect(levelFromXp(-5)).toBe(0);
  });

  it("stops at the maximum level", () => {
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
    expect(progressOf(Number.MAX_SAFE_INTEGER).percent).toBe(100);
  });
});

describe("progressOf", () => {
  it("shows the XP gathered towards the next level", () => {
    expect(progressOf(0)).toEqual({ level: 0, into: 0, needed: 100, percent: 0, total: 0 });
    expect(progressOf(150)).toEqual({ level: 1, into: 50, needed: 155, percent: 32, total: 150 });
  });
});

describe("fillLevelTemplate", () => {
  it("fills the placeholders and keeps unknown ones", () => {
    expect(fillLevelTemplate("GG {user} ({username}) level {level} {x}", { user: "<@1>", username: "bob", level: "7" })).toBe("GG <@1> (bob) level 7 {x}");
  });
});

describe("levelSettingsSchema", () => {
  const base = {
    enabled: true,
    xpMin: 15,
    xpMax: 25,
    cooldownSeconds: 60,
    voiceXpPerMinute: 5,
    announce: "same",
    announceChannelId: "",
    announceTemplate: "GG {user} {level}",
    noXpChannelIds: [],
    noXpRoleIds: [],
    stackRoles: true,
    publicLeaderboard: false,
    voiceRequiresUnmuted: false,
    resetEvery: "off",
    eventBoostPercent: 100,
    eventBoostUntil: "",
    rewards: [],
    boosts: [],
  };
  const parse = (over: Record<string, unknown>) => levelSettingsSchema.safeParse({ ...base, ...over });
  it("a server-wide boost needs an end time", () => {
    expect(parse({ eventBoostPercent: 200, eventBoostUntil: "2026-11-12T00:00" }).success).toBe(true);
    expect(parse({ eventBoostPercent: 200, eventBoostUntil: "" }).success).toBe(false);
    expect(parse({ eventBoostPercent: 99 }).success).toBe(false);
    expect(parse({ eventBoostPercent: 501, eventBoostUntil: "2026-11-12T00:00" }).success).toBe(false);
  });
  const role = (i: number) => `1000000000000000${String(i).padStart(2, "0")}`;

  it("accepts the defaults", () => {
    expect(parse({}).success).toBe(true);
  });

  it("keeps the ranges sensible", () => {
    expect(parse({ xpMin: 30, xpMax: 20 }).success).toBe(false);
    expect(parse({ xpMax: 101 }).success).toBe(false);
    expect(parse({ cooldownSeconds: 3601 }).success).toBe(false);
    expect(parse({ voiceXpPerMinute: 51 }).success).toBe(false);
  });

  it("needs a channel when announcing in one", () => {
    expect(parse({ announce: "channel" }).success).toBe(false);
    expect(parse({ announce: "channel", announceChannelId: "123456789012345678" }).success).toBe(true);
  });

  it("allows at most 25 rewards, each level and role once", () => {
    expect(parse({ rewards: [{ level: 5, roleId: role(1) }, { level: 10, roleId: role(2) }] }).success).toBe(true);
    expect(parse({ rewards: [{ level: 5, roleId: role(1) }, { level: 5, roleId: role(2) }] }).success).toBe(false);
    expect(parse({ rewards: [{ level: 5, roleId: role(1) }, { level: 6, roleId: role(1) }] }).success).toBe(false);
    expect(parse({ rewards: [{ level: 0, roleId: role(1) }] }).success).toBe(false);
    expect(parse({ rewards: [{ level: 501, roleId: role(1) }] }).success).toBe(false);
    expect(parse({ rewards: Array.from({ length: 26 }, (_, i) => ({ level: i + 1, roleId: role(i) })) }).success).toBe(false);
  });
});

describe("XP boosts", () => {
  const boosts = [
    { roleId: "booster", percent: 150 },
    { roleId: "supporter", percent: 200 },
  ];
  it("no matching role means no boost", () => {
    expect(boostPercent(new Set(["other"]), boosts)).toBe(100);
    expect(boostPercent(new Set(), [])).toBe(100);
  });
  it("one boost applies, and the highest wins when a member holds several (they don't stack)", () => {
    expect(boostPercent(new Set(["booster"]), boosts)).toBe(150);
    expect(boostPercent(new Set(["booster", "supporter"]), boosts)).toBe(200);
  });
  it("applyBoost rounds and never lowers the amount", () => {
    expect(applyBoost(20, 150)).toBe(30);
    expect(applyBoost(15, 150)).toBe(23);
    expect(applyBoost(5, 101)).toBe(5);
    expect(applyBoost(20, 100)).toBe(20);
    expect(applyBoost(20, 50)).toBe(20);
  });
});

describe("server-wide XP boost", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  it("is on only before its end and above 100", () => {
    expect(eventBoost(200, new Date("2026-11-12T00:00:00Z"), now)).toBe(200);
    expect(eventBoost(200, new Date("2026-11-11T11:59:00Z"), now)).toBe(100);
    expect(eventBoost(200, null, now)).toBe(100);
    expect(eventBoost(100, new Date("2026-11-12T00:00:00Z"), now)).toBe(100);
  });
});
