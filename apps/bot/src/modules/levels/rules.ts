// The rules of leveling that need no Discord and no database. Pure, so they are testable.

export type Reward = { level: number; roleId: string };

/** A random whole number in [min, max]. `random` is injected for tests. */
export function rollXp(min: number, max: number, random: () => number = Math.random): number {
  const lo = Math.max(1, Math.floor(min));
  const hi = Math.max(lo, Math.floor(max));
  return lo + Math.floor(random() * (hi - lo + 1));
}

/** Has the cooldown passed since the member last earned message XP? */
export function cooldownPassed(lastAt: number | undefined, now: number, cooldownSeconds: number): boolean {
  return lastAt === undefined || now - lastAt >= cooldownSeconds * 1000;
}

/**
 * Which reward roles a member of `level` should hold. With `stack`, every reward at or below the
 * level; without, only the highest one. Returns what to add and what to remove, given what they
 * hold now, and only ever touches the reward roles (never any other role of theirs).
 */
export function planRewardRoles(input: { rewards: Reward[]; level: number; stack: boolean; held: ReadonlySet<string> }): { add: string[]; remove: string[] } {
  const reached = input.rewards.filter((r) => r.level <= input.level).sort((a, b) => a.level - b.level);
  const wanted = new Set(input.stack ? reached.map((r) => r.roleId) : reached.slice(-1).map((r) => r.roleId));
  const allRewardRoles = new Set(input.rewards.map((r) => r.roleId));
  const add = [...wanted].filter((id) => !input.held.has(id));
  const remove = [...allRewardRoles].filter((id) => !wanted.has(id) && input.held.has(id));
  return { add, remove };
}

/** Does this message earn XP? (Not in a no-XP channel or category, not from a no-XP role.) */
export function earnsXp(input: { channelId: string; parentId: string | null; memberRoleIds: ReadonlySet<string>; noXpChannelIds: string[]; noXpRoleIds: string[] }): boolean {
  if (input.noXpChannelIds.includes(input.channelId)) return false;
  if (input.parentId && input.noXpChannelIds.includes(input.parentId)) return false;
  return !input.noXpRoleIds.some((id) => input.memberRoleIds.has(id));
}

/** Start (UTC) of the week (Monday 00:00) or month the given moment falls in. */
export function periodStart(mode: "weekly" | "monthly", now: Date): Date {
  if (mode === "monthly") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday));
}

/**
 * Is a periodic XP reset due? "seed" = the first run: only record the time, never wipe (a freshly switched-on reset must
 * not erase anything); "reset" = a new period began after the last reset.
 */
export function resetDue(mode: string, lastResetAt: Date | null, now: Date): "none" | "seed" | "reset" {
  if (mode !== "weekly" && mode !== "monthly") return "none";
  if (lastResetAt === null) return "seed";
  return lastResetAt.getTime() < periodStart(mode, now).getTime() ? "reset" : "none";
}
