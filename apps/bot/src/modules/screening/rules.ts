import type { ScreeningDecision } from "@aboutselphy/shared/screening";

// Pure parts of the screening queue: the buttons on a card and what a decision does. Pure, so the rules are tested.

export const SCREENING_PREFIX = "sc";
export const screeningControlId = (decision: ScreeningDecision, id: string) => `${SCREENING_PREFIX}:${decision}:${id}`;

/** Strict parse: only our own shape with an id-looking part. */
export function parseScreeningControl(customId: string): { decision: ScreeningDecision; id: string } | null {
  const m = /^sc:(approve|reject):([a-z0-9]{10,40})$/.exec(customId);
  return m ? { decision: m[1] as ScreeningDecision, id: m[2]! } : null;
}

export type EntryStatus = "pending" | "approved" | "rejected" | "left";

/** Only a pending entry can be decided: a second click, or a decision on a member who left, does nothing. */
export const canDecide = (status: string): boolean => status === "pending";

/** The status a decision leads to. */
export const statusAfter = (decision: ScreeningDecision): EntryStatus => (decision === "approve" ? "approved" : "rejected");

/** The reason that goes into the case and the audit log when a rejection kicks the member. */
export const REJECT_REASON = "Rejected in the screening queue";

/** Has a waiting member been waiting longer than the limit? 0 (or less) = never. */
export function waitedTooLong(joinedAt: Date, days: number, now: Date): boolean {
  return days > 0 && now.getTime() - joinedAt.getTime() > days * 86_400_000;
}
