// Private to the levels module: only config.ts, service.ts and commands.ts import this.
import { prisma, type LevelBoost, type LevelConfig, type LevelReward, type MemberXp } from "@aboutselphy/db";

export function readConfig(): Promise<LevelConfig> {
  return prisma.levelConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export const listBoosts = (): Promise<LevelBoost[]> => prisma.levelBoost.findMany();

export function listRewards(): Promise<LevelReward[]> {
  return prisma.levelReward.findMany({ orderBy: { level: "asc" } });
}

/**
 * Adds XP in one atomic step (so two messages at once can't lose one) and returns the total
 * before and after. The row is created on the first XP.
 */
export async function addXp(userId: string, amount: number, name: string, delta: { messages?: number; voiceMinutes?: number } = {}): Promise<{ before: number; after: number }> {
  const row = await prisma.memberXp.upsert({
    where: { userId },
    create: { userId, xp: amount, messages: delta.messages ?? 0, voiceMinutes: delta.voiceMinutes ?? 0, name: name.slice(0, 100) },
    update: { xp: { increment: amount }, messages: { increment: delta.messages ?? 0 }, voiceMinutes: { increment: delta.voiceMinutes ?? 0 }, name: name.slice(0, 100) },
  });
  return { before: row.xp - amount, after: row.xp };
}

/** Sets a member's XP exactly (admin command). Returns the total before and after. */
export async function setXp(userId: string, xp: number, name: string): Promise<{ before: number; after: number }> {
  const existing = await prisma.memberXp.findUnique({ where: { userId } });
  const value = Math.max(0, Math.floor(xp));
  await prisma.memberXp.upsert({ where: { userId }, create: { userId, xp: value, name: name.slice(0, 100) }, update: { xp: value, name: name.slice(0, 100) } });
  return { before: existing?.xp ?? 0, after: value };
}

export async function resetXp(userId: string): Promise<boolean> {
  return (await prisma.memberXp.deleteMany({ where: { userId } })).count > 0;
}

export function findXp(userId: string): Promise<MemberXp | null> {
  return prisma.memberXp.findUnique({ where: { userId } });
}

/** 1 = the most XP. Members with no XP row are not ranked. */
export async function rankOf(xp: number): Promise<number> {
  return (await prisma.memberXp.count({ where: { xp: { gt: xp } } })) + 1;
}

export function topMembers(skip: number, take: number): Promise<MemberXp[]> {
  return prisma.memberXp.findMany({ orderBy: [{ xp: "desc" }, { userId: "asc" }], skip, take });
}

export function countMembers(): Promise<number> {
  return prisma.memberXp.count();
}

/** One conditional UPDATE decides who runs the periodic reset: only the call that still sees `previous` wins. */
export async function claimReset(previous: Date | null, now: Date): Promise<boolean> {
  const { count } = await prisma.levelConfig.updateMany({ where: { id: 1, lastResetAt: previous }, data: { lastResetAt: now } });
  return count === 1;
}

/** Sets everyone's XP, messages and voice minutes back to zero (the rows stay, so names and the hidden flag survive). */
export async function wipeAllXp(): Promise<number> {
  return (await prisma.memberXp.updateMany({ data: { xp: 0, messages: 0, voiceMinutes: 0 } })).count;
}
