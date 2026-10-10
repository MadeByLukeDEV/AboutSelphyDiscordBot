import "server-only";
// Private to the auto-publish module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

export const listPublishChannels = () => prisma.autoPublishChannel.findMany({ orderBy: { createdAt: "asc" } });
export const findPublishChannel = (channelId: string) => prisma.autoPublishChannel.findUnique({ where: { channelId } });
export const addPublishChannel = (channelId: string) => prisma.autoPublishChannel.create({ data: { channelId } });
export const removePublishChannel = async (channelId: string) => (await prisma.autoPublishChannel.deleteMany({ where: { channelId } })).count;
