// Warning escalation: every N-th active warning of a member triggers an action.
// Pure, so the rule is testable.

export type EscalationAction = "timeout" | "kick" | "ban";

export type EscalationRule = {
  threshold: number;
  action: EscalationAction;
  /** Timeout length, or a temporary ban's length; null on a ban = permanent. */
  durationSeconds: number | null;
};

/** The rule from the stored settings, or null if escalation is off or half-configured. */
export function ruleFrom(config: {
  escalationThreshold: number | null;
  escalationAction: EscalationAction | null;
  escalationDurationSeconds: number | null;
}): EscalationRule | null {
  if (config.escalationThreshold === null || config.escalationAction === null) return null;
  if (config.escalationAction === "timeout" && config.escalationDurationSeconds === null) return null;
  return {
    threshold: config.escalationThreshold,
    action: config.escalationAction,
    durationSeconds: config.escalationAction === "kick" ? null : config.escalationDurationSeconds,
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
