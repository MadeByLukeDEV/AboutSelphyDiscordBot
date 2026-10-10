import "server-only";
// Private to the sticky module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

export const listStickies = () => prisma.stickyMessage.findMany({ orderBy: { createdAt: "asc" } });
export const findSticky = (id: string) => prisma.stickyMessage.findUnique({ where: { id } });
export const findByChannel = (channelId: string) => prisma.stickyMessage.findUnique({ where: { channelId } });
export const countStickies = () => prisma.stickyMessage.count();
export const createSticky = (data: { channelId: string; content: string; enabled: boolean }) => prisma.stickyMessage.create({ data: { ...data, dirty: true } });
export const updateSticky = (id: string, data: { content: string; enabled: boolean }) => prisma.stickyMessage.update({ where: { id }, data: { ...data, dirty: true } });
export const deleteSticky = async (id: string) => (await prisma.stickyMessage.deleteMany({ where: { id } })).count;
