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

const onBoard = { boardMessageId: { not: null } } as const;

export const countOnBoard = () => prisma.starboardPost.count({ where: onBoard });

/** A random post that is on the board (skip a random number of rows; fine at this size). */
export async function randomOnBoard(count: number): Promise<StarboardPost | null> {
  if (count <= 0) return null;
  return prisma.starboardPost.findFirst({ where: onBoard, orderBy: { sourceMessageId: "asc" }, skip: Math.floor(Math.random() * count) });
}

export async function authorStats(authorId: string): Promise<{ posts: number; stars: number }> {
  const r = await prisma.starboardPost.aggregate({ where: { authorId, ...onBoard }, _count: { _all: true }, _sum: { stars: true } });
  return { posts: r._count._all, stars: r._sum.stars ?? 0 };
}

export async function topAuthors(take: number): Promise<Array<{ authorId: string; posts: number; stars: number }>> {
  const rows = await prisma.starboardPost.groupBy({ by: ["authorId"], where: onBoard, _count: { _all: true }, _sum: { stars: true }, orderBy: [{ _count: { authorId: "desc" } }, { _sum: { stars: "desc" } }], take });
  return rows.map((r) => ({ authorId: r.authorId, posts: r._count._all, stars: r._sum.stars ?? 0 }));
}
