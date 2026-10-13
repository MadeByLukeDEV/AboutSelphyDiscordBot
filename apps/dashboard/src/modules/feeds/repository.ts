import "server-only";
// Private to the feeds module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

type Data = { name: string; channelId: string; pingRoleId: string | null; messageTemplate: string; intervalMinutes: number; includeWords: string[]; excludeWords: string[]; useEmbed: boolean; enabled: boolean };

export const listFeeds = () => prisma.feedSource.findMany({ orderBy: { createdAt: "asc" } });
export const findFeed = (id: string) => prisma.feedSource.findUnique({ where: { id } });
export const countFeeds = () => prisma.feedSource.count();
export const createFeed = (data: Data & { urlEnc: string; createdByName: string }) => prisma.feedSource.create({ data });
/** A new address starts over: the first check after it only remembers what is there. */
export const updateFeed = (id: string, data: Data & { urlEnc?: string }) => prisma.feedSource.update({ where: { id }, data: { ...data, ...(data.urlEnc ? { baselined: false } : {}) } });
export const deleteFeed = async (id: string) => (await prisma.feedSource.deleteMany({ where: { id } })).count;
