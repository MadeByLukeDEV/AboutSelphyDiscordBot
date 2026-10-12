import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ROWS, parseXpImport } from "@aboutselphy/shared/levels-import";
import { periodStart, resetDue } from "./rules";

const A = "123456789012345678";
const B = "223456789012345678";

describe("parseXpImport", () => {
  it("reads a MEE6 leaderboard", () => {
    const text = JSON.stringify({ players: [{ id: A, username: "Ann", xp: 1500 }, { id: B, username: "Bob", xp: 20 }] });
    expect(parseXpImport(text)).toEqual({ rows: [{ userId: A, xp: 1500, name: "Ann" }, { userId: B, xp: 20, name: "Bob" }], skipped: 0 });
  });
  it("reads a bare array and string ids", () => {
    expect(parseXpImport(JSON.stringify([{ id: A, xp: "300" }])).rows).toEqual([{ userId: A, xp: 300, name: "" }]);
  });
  it("reads lines separated by space, comma or tab, with a name", () => {
    const r = parseXpImport(`${A} 100 Ann Lee\n${B},200\n\n`);
    expect(r.rows).toEqual([{ userId: A, xp: 100, name: "Ann Lee" }, { userId: B, xp: 200, name: "" }]);
    expect(r.skipped).toBe(0);
  });
  it("counts unusable entries and never throws", () => {
    const r = parseXpImport(`${A} -5\nnot a line\n123 50\n${B} 10`);
    expect(r.rows).toEqual([{ userId: B, xp: 10, name: "" }]);
    expect(r.skipped).toBe(3);
    expect(parseXpImport("{broken").rows).toEqual([]);
    expect(parseXpImport("").rows).toEqual([]);
  });
  it("keeps the larger total for a repeated member and caps absurd XP", () => {
    expect(parseXpImport(`${A} 10\n${A} 50`).rows).toEqual([{ userId: A, xp: 50, name: "" }]);
    expect(parseXpImport(`${A} 99999999999999`).rows).toEqual([]);
  });
  it("limits the number of rows", () => {
    const lines = Array.from({ length: MAX_IMPORT_ROWS + 3 }, (_, i) => `${String(100000000000000000n + BigInt(i))} 1`).join("\n");
    const r = parseXpImport(lines);
    expect(r.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(r.skipped).toBe(3);
  });
});

describe("periodic reset", () => {
  const at = (s: string) => new Date(s);
  it("weekly periods start on Monday 00:00 UTC", () => {
    expect(periodStart("weekly", at("2026-11-04T15:00:00Z"))).toEqual(at("2026-11-02T00:00:00Z")); // a Wednesday
    expect(periodStart("weekly", at("2026-11-02T00:00:00Z"))).toEqual(at("2026-11-02T00:00:00Z"));
    expect(periodStart("weekly", at("2026-11-08T23:59:00Z"))).toEqual(at("2026-11-02T00:00:00Z")); // a Sunday
  });
  it("monthly periods start on the 1st", () => {
    expect(periodStart("monthly", at("2026-11-30T23:00:00Z"))).toEqual(at("2026-11-01T00:00:00Z"));
  });
  it("the first run only records the time, never wipes", () => {
    expect(resetDue("weekly", null, at("2026-11-04T10:00:00Z"))).toBe("seed");
  });
  it("wipes once a new period has begun", () => {
    expect(resetDue("weekly", at("2026-11-03T10:00:00Z"), at("2026-11-04T10:00:00Z"))).toBe("none");
    expect(resetDue("weekly", at("2026-11-03T10:00:00Z"), at("2026-11-09T00:00:01Z"))).toBe("reset");
    expect(resetDue("monthly", at("2026-11-20T10:00:00Z"), at("2026-12-01T00:00:00Z"))).toBe("reset");
  });
  it("is off when off or unknown", () => {
    expect(resetDue("off", null, new Date())).toBe("none");
    expect(resetDue("yearly", null, new Date())).toBe("none");
  });
});

import { formatVoiceTime } from "./rules";

describe("formatVoiceTime", () => {
  it("shows minutes, then hours and minutes", () => {
    expect(formatVoiceTime(0)).toBe("0m");
    expect(formatVoiceTime(45)).toBe("45m");
    expect(formatVoiceTime(135)).toBe("2h 15m");
    expect(formatVoiceTime(-5)).toBe("0m");
  });
});
