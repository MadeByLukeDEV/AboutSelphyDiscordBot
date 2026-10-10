import { describe, expect, it } from "vitest";
import { escalationDue, ruleFrom, windowStart, type EscalationRule } from "./escalation";

const rule = (over: Partial<EscalationRule> = {}): EscalationRule => ({ threshold: 3, action: "timeout", durationSeconds: 3600, windowDays: null, ...over });

describe("ruleFrom", () => {
  it("is null when escalation is off", () => {
    expect(ruleFrom({ escalationThreshold: null, escalationAction: null, escalationDurationSeconds: null, escalationWindowDays: null })).toBeNull();
  });

  it("builds a rule from the settings", () => {
    expect(ruleFrom({ escalationThreshold: 3, escalationAction: "timeout", escalationDurationSeconds: 600, escalationWindowDays: 30 })).toEqual({
      threshold: 3,
      action: "timeout",
      durationSeconds: 600,
      windowDays: 30,
    });
  });

  it("ignores a duration on a kick and refuses a timeout without one", () => {
    expect(ruleFrom({ escalationThreshold: 3, escalationAction: "kick", escalationDurationSeconds: 600, escalationWindowDays: null })?.durationSeconds).toBeNull();
    expect(ruleFrom({ escalationThreshold: 3, escalationAction: "timeout", escalationDurationSeconds: null, escalationWindowDays: null })).toBeNull();
  });

  it("allows a permanent ban", () => {
    expect(ruleFrom({ escalationThreshold: 5, escalationAction: "ban", escalationDurationSeconds: null, escalationWindowDays: null })).toMatchObject({ action: "ban", durationSeconds: null });
  });
});

describe("escalationDue", () => {
  it("fires on every full set of warnings, not on the ones in between", () => {
    const r = rule();
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => escalationDue(n, r))).toEqual([false, false, true, false, false, true, false]);
  });

  it("never fires with escalation off or with no warnings", () => {
    expect(escalationDue(3, null)).toBe(false);
    expect(escalationDue(0, rule())).toBe(false);
  });
});

describe("windowStart", () => {
  const now = new Date("2026-10-12T12:00:00Z");

  it("is null without a window", () => {
    expect(windowStart(rule(), now)).toBeNull();
  });

  it("counts back the given number of days", () => {
    expect(windowStart(rule({ windowDays: 30 }), now)?.toISOString()).toBe("2026-09-12T12:00:00.000Z");
  });
});
