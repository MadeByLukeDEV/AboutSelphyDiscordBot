import "server-only";
// Private to the twitchvip module: only service.ts imports this.
import { prisma, type TwitchVipConfig, type TwitchVipLink } from "@aboutselphy/db";

export const readConfig = (): Promise<TwitchVipConfig> => prisma.twitchVipConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateConfig(data: { enabled: boolean; roleId: string | null }): Promise<TwitchVipConfig> {
  return prisma.twitchVipConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

/** Pending claims first, then the approved ones, newest first. */
export const listLinks = (): Promise<TwitchVipLink[]> => prisma.twitchVipLink.findMany({ orderBy: [{ approved: "asc" }, { createdAt: "desc" }], take: 500 });

export const findLink = (id: string): Promise<TwitchVipLink | null> => prisma.twitchVipLink.findUnique({ where: { id } });

/** One conditional UPDATE: false when it was already approved (or is gone). */
export async function approveLink(id: string, by: string): Promise<boolean> {
  const { count } = await prisma.twitchVipLink.updateMany({ where: { id, approved: false }, data: { approved: true, approvedByName: by.slice(0, 100), approvedAt: new Date() } });
  return count > 0;
}
