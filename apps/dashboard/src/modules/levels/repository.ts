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
