import "server-only";
// Private to the starboard module: only service.ts imports this.
import { prisma, type StarboardConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<StarboardConfig> => prisma.starboardConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateConfig(data: { enabled: boolean; channelId: string | null; emoji: string; threshold: number; allowSelf: boolean }): Promise<StarboardConfig> {
  return prisma.starboardConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

/** The most starred messages first. */
export const topPosts = (take: number) => prisma.starboardPost.findMany({ orderBy: [{ stars: "desc" }, { createdAt: "desc" }], take });
