import { describe, expect, it } from "vitest";
import { escalationDue, ruleFrom, type EscalationRule } from "./escalation";

const rule = (over: Partial<EscalationRule> = {}): EscalationRule => ({ threshold: 3, action: "timeout", durationSeconds: 3600, ...over });

describe("ruleFrom", () => {
  it("is null when escalation is off", () => {
    expect(ruleFrom({ escalationThreshold: null, escalationAction: null, escalationDurationSeconds: null })).toBeNull();
  });

  it("builds a rule from the settings", () => {
    expect(ruleFrom({ escalationThreshold: 3, escalationAction: "timeout", escalationDurationSeconds: 600 })).toEqual({
      threshold: 3,
      action: "timeout",
      durationSeconds: 600,
    });
  });

  it("ignores a duration on a kick and refuses a timeout without one", () => {
    expect(ruleFrom({ escalationThreshold: 3, escalationAction: "kick", escalationDurationSeconds: 600 })?.durationSeconds).toBeNull();
    expect(ruleFrom({ escalationThreshold: 3, escalationAction: "timeout", escalationDurationSeconds: null })).toBeNull();
  });

  it("allows a permanent ban", () => {
    expect(ruleFrom({ escalationThreshold: 5, escalationAction: "ban", escalationDurationSeconds: null })).toMatchObject({ action: "ban", durationSeconds: null });
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
