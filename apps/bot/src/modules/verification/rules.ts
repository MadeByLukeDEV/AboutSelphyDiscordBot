// Pure parts of the verification gate: reading an answer, the account-age rule and who an unverified-kick may touch.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** What counts as the same answer: letters of any case, one space between words, compatible characters folded (NFKC). */
export function normalizeAnswer(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

/** The member's text against the expected answer. An empty expected answer never matches anything. */
export function answerMatches(given: string, expected: string): boolean {
  const want = normalizeAnswer(expected);
  return want !== "" && normalizeAnswer(given) === want;
}

/** Old enough to verify? `days` of 0 means no limit. */
export function oldEnough(createdAt: Date, now: Date, days: number): boolean {
  return days <= 0 || now.getTime() - createdAt.getTime() >= days * DAY_MS;
}

/** Whole days until an account is old enough (0 when it already is). */
export function daysUntilOldEnough(createdAt: Date, now: Date, days: number): number {
  if (oldEnough(createdAt, now, days)) return 0;
  return Math.ceil((createdAt.getTime() + days * DAY_MS - now.getTime()) / DAY_MS);
}

export type KickCandidate = {
  isBot: boolean;
  isStaff: boolean;
  hasVerifiedRole: boolean;
  /** Roles other than @everyone and the "unverified" role (someone with other roles was let in by hand). */
  otherRoleCount: number;
  joinedAt: Date | null;
};

/**
 * Whether a member who never verified should be kicked. Only members who joined AFTER the gate was switched on (so
 * nobody who was already here is ever touched), never bots or staff, never anyone who verified or was given another
 * role by hand, and only once `hours` have passed. 0 hours means never.
 */
export function shouldKickUnverified(c: KickCandidate, enabledAt: Date | null, now: Date, hours: number): boolean {
  if (hours <= 0 || !enabledAt || !c.joinedAt) return false;
  if (c.isBot || c.isStaff || c.hasVerifiedRole || c.otherRoleCount > 0) return false;
  if (c.joinedAt.getTime() <= enabledAt.getTime()) return false;
  return now.getTime() - c.joinedAt.getTime() >= hours * HOUR_MS;
}
