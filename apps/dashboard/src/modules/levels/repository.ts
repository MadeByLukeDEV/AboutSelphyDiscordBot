import "server-only";
// Private to the levels module: only service.ts imports this.
import { prisma, type LevelConfig, type LevelReward, type MemberXp } from "@aboutselphy/db";

export async function readConfig(): Promise<{ config: LevelConfig; rewards: LevelReward[]; boosts: Array<{ roleId: string; percent: number }> }> {
  const [config, rewards, boosts] = await Promise.all([
    prisma.levelConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.levelReward.findMany({ orderBy: { level: "asc" } }),
    prisma.levelBoost.findMany({ orderBy: { percent: "desc" } }),
  ]);
  return { config, rewards, boosts: boosts.map((b) => ({ roleId: b.roleId, percent: b.percent })) };
}

export type ConfigData = {
  enabled: boolean;
  xpMin: number;
  xpMax: number;
  cooldownSeconds: number;
  voiceXpPerMinute: number;
  announce: "off" | "same" | "channel";
  announceChannelId: string | null;
  announceTemplate: string;
  noXpChannelIds: string[];
  noXpRoleIds: string[];
  stackRoles: boolean;
  publicLeaderboard: boolean;
  voiceRequiresUnmuted: boolean;
  resetEvery: "off" | "weekly" | "monthly";
  eventBoostPercent: number;
  eventBoostUntil: Date | null;
  /** Set to null when the reset mode changes, so a new schedule never wipes at once. */
  lastResetAt?: null;
};

/** Saves the settings and replaces the whole reward list in one transaction. */
export function saveAll(data: ConfigData, rewards: Array<{ level: number; roleId: string }>, boosts: Array<{ roleId: string; percent: number }>): Promise<unknown> {
  return prisma.$transaction([
    prisma.levelConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } }),
    prisma.levelReward.deleteMany({}),
    prisma.levelReward.createMany({ data: rewards }),
    prisma.levelBoost.deleteMany({}),
    prisma.levelBoost.createMany({ data: boosts }),
  ]);
}

export function topMembers(take: number): Promise<MemberXp[]> {
  return prisma.memberXp.findMany({ orderBy: [{ xp: "desc" }, { userId: "asc" }], take });
}

export function countMembers(): Promise<number> {
  return prisma.memberXp.count();
}

/** The top members for the public page: only those who haven't hidden themselves and have a name to show. */
export function topPublic(take: number): Promise<MemberXp[]> {
  return prisma.memberXp.findMany({ where: { hidden: false, name: { not: "" } }, orderBy: [{ xp: "desc" }, { userId: "asc" }], take });
}

/**
 * Applies imported totals: new members are created, existing ones only ever go up (a smaller imported number never
 * lowers XP earned here). Done in small transactions so a big paste doesn't hold the database.
 */
export async function importRows(rows: Array<{ userId: string; xp: number; name: string }>): Promise<{ created: number; raised: number }> {
  let created = 0;
  let raised = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const known = new Set((await prisma.memberXp.findMany({ where: { userId: { in: chunk.map((r) => r.userId) } }, select: { userId: true } })).map((r) => r.userId));
    const fresh = chunk.filter((r) => !known.has(r.userId));
    const existing = chunk.filter((r) => known.has(r.userId));
    const results = await prisma.$transaction([
      prisma.memberXp.createMany({ data: fresh.map((r) => ({ userId: r.userId, xp: r.xp, name: r.name })), skipDuplicates: true }),
      ...existing.map((r) => prisma.memberXp.updateMany({ where: { userId: r.userId, xp: { lt: r.xp } }, data: { xp: r.xp } })),
    ]);
    created += results[0]!.count;
    for (const r of results.slice(1)) raised += r.count;
  }
  return { created, raised };
}
