// Pure parts of invite tracking: which invite a new member used. Discord doesn't say, so the bot keeps the use counts of every
// invite and compares them when someone joins. Pure, so the rules are tested.

export type InviteInfo = { code: string; uses: number; maxUses: number; inviterId: string | null };
export type Snapshot = ReadonlyMap<string, InviteInfo>;

export type Detected = { source: "invite"; code: string; inviterId: string | null } | { source: "vanity" } | { source: "unknown" };

/**
 * Which invite got the join. `before` is what we knew, `after` what Discord lists now, `vanity` the use counts of the server's
 * custom URL (null when it has none).
 *  - exactly one invite's use count went up: that one (a brand-new invite already used counts as going up from 0);
 *  - none went up, but one that had a use limit and was one short of it has disappeared: its last use was this join;
 *  - none of that, but the custom URL's count went up: the custom URL;
 *  - anything else (nothing changed, or several candidates at once): unknown. Never guess between two.
 */
export function detectInvite(before: Snapshot, after: readonly InviteInfo[], vanity: { before: number; after: number } | null): Detected {
  const up = after.filter((i) => i.uses > (before.get(i.code)?.uses ?? 0));
  if (up.length === 1) return { source: "invite", code: up[0]!.code, inviterId: up[0]!.inviterId };
  if (up.length > 1) return { source: "unknown" };

  const stillThere = new Set(after.map((i) => i.code));
  const vanished = [...before.values()].filter((i) => !stillThere.has(i.code) && i.maxUses > 0 && i.uses + 1 === i.maxUses);
  if (vanished.length === 1) return { source: "invite", code: vanished[0]!.code, inviterId: vanished[0]!.inviterId };
  if (vanished.length > 1) return { source: "unknown" };

  if (vanity && vanity.after > vanity.before) return { source: "vanity" };
  return { source: "unknown" };
}

/** A snapshot from a list. */
export const snapshotOf = (list: readonly InviteInfo[]): Map<string, InviteInfo> => new Map(list.map((i) => [i.code, i]));

/** One line for the join log: who invited, or why it isn't known. Names are escaped by the caller. */
export function describeSource(d: Detected, inviterName: string | null): string {
  if (d.source === "vanity") return "the server's custom URL";
  if (d.source === "invite") return inviterName ? `${inviterName} (invite \`${d.code}\`)` : `invite \`${d.code}\``;
  return "unknown";
}

export type InviterStats = { total: number; here: number };

/** "12 invited, 9 still here" for /invites. */
export function statsLine(s: InviterStats): string {
  const left = s.total - s.here;
  return `${s.total} ${s.total === 1 ? "member" : "members"} joined through their invites: ${s.here} still here, ${left} left.`;
}
