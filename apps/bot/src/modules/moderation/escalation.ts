// Warning escalation: every N-th active warning of a member triggers an action.
// Pure, so the rule is testable.

export type EscalationAction = "timeout" | "kick" | "ban";

export type EscalationRule = {
  threshold: number;
  action: EscalationAction;
  /** Timeout length, or a temporary ban's length; null on a ban = permanent. */
  durationSeconds: number | null;
  /** Only warnings from the last N days count; null = every active warning. */
  windowDays: number | null;
};

/** The rule from the stored settings, or null if escalation is off or half-configured. */
export function ruleFrom(config: {
  escalationThreshold: number | null;
  escalationAction: EscalationAction | null;
  escalationDurationSeconds: number | null;
  escalationWindowDays: number | null;
}): EscalationRule | null {
  if (config.escalationThreshold === null || config.escalationAction === null) return null;
  if (config.escalationAction === "timeout" && config.escalationDurationSeconds === null) return null;
  return {
    threshold: config.escalationThreshold,
    action: config.escalationAction,
    durationSeconds: config.escalationAction === "kick" ? null : config.escalationDurationSeconds,
    windowDays: config.escalationWindowDays,
  };
}

/**
 * True when the warning just given is the 2nd, 4th, ... (for a threshold of 2) active
 * warning. Using a multiple, not "at least", means a member who already took the
 * action isn't hit again by every further warning, only by the next full set.
 */
export function escalationDue(activeWarnings: number, rule: EscalationRule | null): boolean {
  return rule !== null && activeWarnings > 0 && activeWarnings % rule.threshold === 0;
}

/** When counting starts: warnings given before this don't count. Null = no window. */
export function windowStart(rule: EscalationRule, now: Date): Date | null {
  return rule.windowDays === null ? null : new Date(now.getTime() - rule.windowDays * 86_400_000);
}
