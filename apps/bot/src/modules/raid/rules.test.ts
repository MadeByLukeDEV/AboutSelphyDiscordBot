import { describe, expect, it } from "vitest";
import { raidSettingsSchema } from "@aboutselphy/shared/entry";
import { isRaid, raidActive, recentJoins } from "./rules";

describe("recentJoins", () => {
  it("keeps only the joins inside the window", () => {
    const now = 100_000;
    expect(recentJoins([10_000, 89_000, 95_000, 99_999], now, 20)).toEqual([89_000, 95_000, 99_999]);
  });
  it("drops joins that claim to be in the future", () => {
    expect(recentJoins([100_001], 100_000, 20)).toEqual([]);
  });
});

describe("isRaid", () => {
  it("triggers at the threshold, not below it", () => {
    expect(isRaid(4, 5)).toBe(false);
    expect(isRaid(5, 5)).toBe(true);
    expect(isRaid(9, 5)).toBe(true);
  });
});

describe("raidActive", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  it("is on until the end time", () => {
    expect(raidActive(new Date("2026-11-03T12:00:01Z"), now)).toBe(true);
    expect(raidActive(new Date("2026-11-03T12:00:00Z"), now)).toBe(false);
    expect(raidActive(null, now)).toBe(false);
  });
});

describe("settings", () => {
  const ok = { enabled: true, joinThreshold: 8, windowSeconds: 30, action: "timeout", actionMinutes: 60, raidMinutes: 20 };
  it("accepts sane values", () => {
    expect(raidSettingsSchema.safeParse(ok).success).toBe(true);
  });
  it("refuses a threshold under 3 (two friends joining is not a raid), a tiny window and unknown actions", () => {
    expect(raidSettingsSchema.safeParse({ ...ok, joinThreshold: 2 }).success).toBe(false);
    expect(raidSettingsSchema.safeParse({ ...ok, windowSeconds: 4 }).success).toBe(false);
    expect(raidSettingsSchema.safeParse({ ...ok, action: "ban" }).success).toBe(false);
    expect(raidSettingsSchema.safeParse({ ...ok, raidMinutes: 181 }).success).toBe(false);
  });
});
