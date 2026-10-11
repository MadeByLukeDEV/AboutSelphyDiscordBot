// Private to the feeds module: only service.ts imports this.
import { prisma, type FeedSource } from "@aboutselphy/db";

export const listEnabled = (): Promise<FeedSource[]> => prisma.feedSource.findMany({ where: { enabled: true } });
export const findFeed = (id: string): Promise<FeedSource | null> => prisma.feedSource.findUnique({ where: { id } });

export async function seenGuids(feedId: string, guids: string[]): Promise<Set<string>> {
  if (guids.length === 0) return new Set();
  return new Set((await prisma.feedItem.findMany({ where: { feedId, guid: { in: guids } }, select: { guid: true } })).map((r) => r.guid));
}

/** Remembers items. Returns false when one of them was already there (another check got it first). */
export async function remember(feedId: string, guid: string): Promise<boolean> {
  return (await prisma.feedItem.createMany({ data: [{ feedId, guid }], skipDuplicates: true })).count > 0;
}

export const rememberMany = (feedId: string, guids: string[]) => prisma.feedItem.createMany({ data: guids.map((guid) => ({ feedId, guid })), skipDuplicates: true });

export const markChecked = (id: string, status: string, baselined?: boolean) => prisma.feedSource.updateMany({ where: { id }, data: { lastCheckedAt: new Date(), lastStatus: status.slice(0, 24), ...(baselined ? { baselined: true } : {}) } });

/** Seen-items older than this are forgotten (a feed only lists its newest items; the freshness rule covers the rest). */
export const pruneItems = (before: Date) => prisma.feedItem.deleteMany({ where: { createdAt: { lt: before } } });
