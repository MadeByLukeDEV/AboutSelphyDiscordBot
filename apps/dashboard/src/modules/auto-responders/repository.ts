import "server-only";
// Private to the auto-responders module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

type Data = { trigger: string; matchType: string; response: string; cooldownSeconds: number; channelIds: string[]; enabled: boolean };

export const listResponders = () => prisma.autoResponder.findMany({ orderBy: { createdAt: "asc" } });
export const findResponder = (id: string) => prisma.autoResponder.findUnique({ where: { id } });
export const countResponders = () => prisma.autoResponder.count();
export const createResponder = (data: Data & { createdByName: string }) => prisma.autoResponder.create({ data });
export const updateResponder = (id: string, data: Data) => prisma.autoResponder.update({ where: { id }, data });
export const deleteResponder = async (id: string) => (await prisma.autoResponder.deleteMany({ where: { id } })).count;
