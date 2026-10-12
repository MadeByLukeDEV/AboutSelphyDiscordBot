import { describe, expect, it } from "vitest";
import { applyCap, limitCap, planAfk, roomBitrate, type RoleRuleRow } from "./roles";

const rules: RoleRuleRow[] = [
  { roleId: "everyone", bitrateKbps: 64, maxUserLimit: 5 },
  { roleId: "boost", bitrateKbps: 128, maxUserLimit: 20 },
  { roleId: "mini", bitrateKbps: null, maxUserLimit: 3 },
];

describe("roomBitrate", () => {
  it("uses the best bitrate among the owner's roles", () => {
    expect(roomBitrate(rules, new Set(), 96_000)).toBe(64_000);
    expect(roomBitrate(rules, new Set(["boost"]), 384_000)).toBe(128_000);
  });
  it("never goes above what the server allows", () => {
    expect(roomBitrate(rules, new Set(["boost"]), 96_000)).toBe(96_000);
  });
  it("is undefined without a rule", () => {
    expect(roomBitrate([], new Set(["boost"]), 96_000)).toBeUndefined();
    expect(roomBitrate([{ roleId: "mini", bitrateKbps: null, maxUserLimit: 3 }], new Set(["mini"]), 96_000)).toBeUndefined();
  });
});

describe("limitCap and applyCap", () => {
  it("takes the highest cap among matching rules (the base rule applies to everyone)", () => {
    expect(limitCap(rules, new Set())).toBe(5);
    expect(limitCap(rules, new Set(["boost"]))).toBe(20);
    expect(limitCap(rules, new Set(["mini"]))).toBe(5);
  });
  it("is null when no rule caps the limit", () => {
    expect(limitCap([], new Set(["boost"]))).toBeNull();
    expect(limitCap([{ roleId: "boost", bitrateKbps: 128, maxUserLimit: null }], new Set(["boost"]))).toBeNull();
  });
  it("lowers a limit above the cap and refuses 'no limit' under a cap", () => {
    expect(applyCap(10, 5)).toBe(5);
    expect(applyCap(0, 5)).toBe(5);
    expect(applyCap(3, 5)).toBe(3);
    expect(applyCap(0, null)).toBe(0);
    expect(applyCap(40, null)).toBe(40);
  });
});

describe("planAfk", () => {
  const MIN = 60_000;
  it("moves a member only after being deafened for the whole time", () => {
    const seen = new Map<string, number>();
    const v = [{ userId: "a", deafened: true, inAfkChannel: false }];
    expect(planAfk(seen, v, 0, 10)).toEqual([]);
    expect(planAfk(seen, v, 9 * MIN, 10)).toEqual([]);
    expect(planAfk(seen, v, 10 * MIN, 10)).toEqual(["a"]);
    expect(seen.has("a")).toBe(false);
  });
  it("starts over when they undeafen", () => {
    const seen = new Map<string, number>();
    planAfk(seen, [{ userId: "a", deafened: true, inAfkChannel: false }], 0, 10);
    planAfk(seen, [{ userId: "a", deafened: false, inAfkChannel: false }], 5 * MIN, 10);
    expect(planAfk(seen, [{ userId: "a", deafened: true, inAfkChannel: false }], 12 * MIN, 10)).toEqual([]);
  });
  it("forgets people who left voice and ignores the AFK channel", () => {
    const seen = new Map<string, number>();
    planAfk(seen, [{ userId: "a", deafened: true, inAfkChannel: false }, { userId: "b", deafened: true, inAfkChannel: true }], 0, 10);
    expect([...seen.keys()]).toEqual(["a"]);
    planAfk(seen, [], 20 * MIN, 10);
    expect(seen.size).toBe(0);
  });
});
