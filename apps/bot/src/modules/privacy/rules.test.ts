import { describe, expect, it } from "vitest";
import { MAX_RETENTION_DAYS, retentionSettingsSchema } from "@aboutselphy/shared/retention";
import { clip, cutoff, describeRun } from "./rules";

const now = new Date("2026-10-30T12:00:00Z");

describe("cutoff", () => {
  it("is null when retention is off", () => {
    expect(cutoff(0, now)).toBeNull();
    expect(cutoff(-5, now)).toBeNull();
    expect(cutoff(1.5, now)).toBeNull();
  });
  it("counts whole days back", () => {
    expect(cutoff(30, now)).toEqual(new Date("2026-09-30T12:00:00Z"));
    expect(cutoff(1, now)).toEqual(new Date("2026-10-29T12:00:00Z"));
  });
});

describe("settings", () => {
  const ok = { ticketTranscriptDays: 0, caseDays: 365, suggestionDays: 180, inactiveXpDays: 730 };
  it("accepts 0 (keep) up to ten years", () => {
    expect(retentionSettingsSchema.safeParse(ok).success).toBe(true);
    expect(retentionSettingsSchema.safeParse({ ...ok, caseDays: MAX_RETENTION_DAYS }).success).toBe(true);
    expect(retentionSettingsSchema.safeParse({ ...ok, caseDays: MAX_RETENTION_DAYS + 1 }).success).toBe(false);
  });
  it("refuses negatives and fractions", () => {
    expect(retentionSettingsSchema.safeParse({ ...ok, caseDays: -1 }).success).toBe(false);
    expect(retentionSettingsSchema.safeParse({ ...ok, suggestionDays: 1.5 }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("describes a run", () => {
    expect(describeRun({ transcripts: 1, cases: 2, suggestions: 3, xp: 4 })).toBe("transcripts 1, cases 2, suggestions 3, level records 4");
  });
  it("clips long text and survives missing text", () => {
    expect(clip("x".repeat(900))).toHaveLength(500);
    expect(clip(null)).toBe("");
  });
});
