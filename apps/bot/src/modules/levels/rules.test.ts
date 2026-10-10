import { describe, expect, it } from "vitest";
import { cooldownPassed, earnsXp, planRewardRoles, rollXp } from "./rules";

describe("rollXp", () => {
  it("stays within the range, both ends reachable", () => {
    expect(rollXp(15, 25, () => 0)).toBe(15);
    expect(rollXp(15, 25, () => 0.999999)).toBe(25);
    for (let i = 0; i < 200; i++) {
      const v = rollXp(15, 25);
      expect(v).toBeGreaterThanOrEqual(15);
      expect(v).toBeLessThanOrEqual(25);
    }
  });

  it("copes with a reversed or tiny range", () => {
    expect(rollXp(10, 5, () => 0.5)).toBe(10);
    expect(rollXp(0, 0, () => 0.5)).toBe(1);
  });
});

describe("cooldownPassed", () => {
  it("passes the first time and after the cooldown", () => {
    expect(cooldownPassed(undefined, 1000, 60)).toBe(true);
    expect(cooldownPassed(0, 59_999, 60)).toBe(false);
    expect(cooldownPassed(0, 60_000, 60)).toBe(true);
    expect(cooldownPassed(1000, 1000, 0)).toBe(true);
  });
});

describe("planRewardRoles", () => {
  const rewards = [
    { level: 5, roleId: "r5" },
    { level: 10, roleId: "r10" },
    { level: 20, roleId: "r20" },
  ];

  it("stacking gives every reward reached and nothing above", () => {
    expect(planRewardRoles({ rewards, level: 12, stack: true, held: new Set() })).toEqual({ add: ["r5", "r10"], remove: [] });
    expect(planRewardRoles({ rewards, level: 12, stack: true, held: new Set(["r5", "r10"]) })).toEqual({ add: [], remove: [] });
    expect(planRewardRoles({ rewards, level: 4, stack: true, held: new Set() })).toEqual({ add: [], remove: [] });
  });

  it("not stacking keeps only the highest and drops the lower rewards", () => {
    expect(planRewardRoles({ rewards, level: 12, stack: false, held: new Set(["r5"]) })).toEqual({ add: ["r10"], remove: ["r5"] });
    expect(planRewardRoles({ rewards, level: 25, stack: false, held: new Set(["r10"]) })).toEqual({ add: ["r20"], remove: ["r10"] });
  });

  it("takes back a reward above the level (after XP was removed) and never touches other roles", () => {
    expect(planRewardRoles({ rewards, level: 3, stack: true, held: new Set(["r5", "other"]) })).toEqual({ add: [], remove: ["r5"] });
  });
});

describe("earnsXp", () => {
  const base = { channelId: "c1", parentId: "cat1", memberRoleIds: new Set(["a"]), noXpChannelIds: [] as string[], noXpRoleIds: [] as string[] };

  it("earns by default", () => {
    expect(earnsXp(base)).toBe(true);
  });

  it("is blocked by a channel, its category or a role", () => {
    expect(earnsXp({ ...base, noXpChannelIds: ["c1"] })).toBe(false);
    expect(earnsXp({ ...base, noXpChannelIds: ["cat1"] })).toBe(false);
    expect(earnsXp({ ...base, noXpRoleIds: ["a"] })).toBe(false);
    expect(earnsXp({ ...base, noXpChannelIds: ["other"], noXpRoleIds: ["b"] })).toBe(true);
  });
});
