// Private to the starboard module: only config.ts and service.ts import this.
import { prisma, type StarboardConfig, type StarboardPost } from "@aboutselphy/db";

export const readConfig = (): Promise<StarboardConfig> => prisma.starboardConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const findPost = (sourceMessageId: string): Promise<StarboardPost | null> => prisma.starboardPost.findUnique({ where: { sourceMessageId } });

export type PostData = { sourceChannelId: string; authorId: string; authorName: string; excerpt: string; jumpUrl: string; stars: number };

export function upsertPost(sourceMessageId: string, data: PostData, boardMessageId: string | null) {
  const row = { ...data, authorName: data.authorName.slice(0, 100), excerpt: data.excerpt.slice(0, 200), boardMessageId };
  return prisma.starboardPost.upsert({ where: { sourceMessageId }, update: row, create: { sourceMessageId, ...row } });
}

export const setStars = (sourceMessageId: string, stars: number) => prisma.starboardPost.updateMany({ where: { sourceMessageId }, data: { stars } });

export const clearBoardMessage = (sourceMessageId: string, stars: number) => prisma.starboardPost.updateMany({ where: { sourceMessageId }, data: { boardMessageId: null, stars } });

export const deletePost = (sourceMessageId: string) => prisma.starboardPost.deleteMany({ where: { sourceMessageId } });

export const findByBoardMessage = (boardMessageId: string) => prisma.starboardPost.findFirst({ where: { boardMessageId } });
