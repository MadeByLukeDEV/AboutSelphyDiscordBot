// Per-role rules for temporary rooms, and the AFK mover. Pure, so they are tested without Discord.

export type RoleRuleRow = { roleId: string; bitrateKbps: number | null; maxUserLimit: number | null };

/** The rules that apply to someone holding `held` ("everyone" is the base rule and applies to all). */
const matching = (rules: readonly RoleRuleRow[], held: ReadonlySet<string>): RoleRuleRow[] => rules.filter((r) => r.roleId === "everyone" || held.has(r.roleId));

/** The bitrate (bit/s) a new room starts with: the best among the owner's rules, never above what the server allows. Undefined = Discord's default. */
export function roomBitrate(rules: readonly RoleRuleRow[], held: ReadonlySet<string>, serverMaxBps: number): number | undefined {
  const kbps = matching(rules, held).reduce((best, r) => (r.bitrateKbps !== null && r.bitrateKbps > best ? r.bitrateKbps : best), 0);
  return kbps > 0 ? Math.min(kbps * 1000, serverMaxBps) : undefined;
}

/** The highest member limit this person may set, or null when none of their rules caps it. */
export function limitCap(rules: readonly RoleRuleRow[], held: ReadonlySet<string>): number | null {
  const caps = matching(rules, held).flatMap((r) => (r.maxUserLimit === null ? [] : [r.maxUserLimit]));
  return caps.length === 0 ? null : Math.max(...caps);
}

/** A limit within the cap: 0 ("no limit") is not allowed under a cap, and anything above it is lowered. */
export function applyCap(limit: number, cap: number | null): number {
  if (cap === null) return limit;
  return limit === 0 || limit > cap ? cap : limit;
}

/**
 * The AFK mover. `seen` remembers since when each member has been self-deafened (ms); it is updated in place.
 * Returns the members who have now been deafened for `minutes`. Muted-only members are never touched (listening
 * with the mic off is normal), and anyone already in the AFK channel is just forgotten.
 */
export function planAfk(seen: Map<string, number>, voice: ReadonlyArray<{ userId: string; deafened: boolean; inAfkChannel: boolean }>, now: number, minutes: number): string[] {
  const present = new Set(voice.map((v) => v.userId));
  for (const id of [...seen.keys()]) if (!present.has(id)) seen.delete(id);
  const due: string[] = [];
  for (const v of voice) {
    if (!v.deafened || v.inAfkChannel) {
      seen.delete(v.userId);
      continue;
    }
    const since = seen.get(v.userId);
    if (since === undefined) seen.set(v.userId, now);
    else if (now - since >= minutes * 60_000) {
      due.push(v.userId);
      seen.delete(v.userId);
    }
  }
  return due;
}
