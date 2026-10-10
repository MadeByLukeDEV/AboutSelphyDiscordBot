import "server-only";
// Private to the stat-channels module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

export const listStatChannels = () => prisma.statChannel.findMany({ orderBy: { createdAt: "asc" } });
export const findStatChannel = (id: string) => prisma.statChannel.findUnique({ where: { id } });
export const findByChannel = (channelId: string) => prisma.statChannel.findUnique({ where: { channelId } });
export const countStatChannels = () => prisma.statChannel.count();
export const createStatChannel = (data: { channelId: string; kind: string; template: string }) => prisma.statChannel.create({ data });
export const updateStatChannel = (id: string, data: { kind: string; template: string }) => prisma.statChannel.update({ where: { id }, data });
export const deleteStatChannel = async (id: string) => (await prisma.statChannel.deleteMany({ where: { id } })).count;
