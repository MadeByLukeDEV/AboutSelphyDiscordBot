import "server-only";
// Private to the productwatch module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

type Data = { name: string; url: string; channelId: string; pingRoleId: string | null; enabled: boolean };

export const listWatches = () => prisma.productWatch.findMany({ orderBy: { createdAt: "asc" } });
export const findWatch = (id: string) => prisma.productWatch.findUnique({ where: { id } });
export const countWatches = () => prisma.productWatch.count();
export const createWatch = (data: Data & { createdByName: string }) => prisma.productWatch.create({ data });
/** A new address starts over: the first look after it only remembers what the product looks like. */
export const updateWatch = (id: string, data: Data, restart: boolean) =>
  prisma.productWatch.update({ where: { id }, data: { ...data, ...(restart ? { baselined: false, snapshot: undefined, lastStatus: null } : {}) } });
export const deleteWatch = async (id: string) => (await prisma.productWatch.deleteMany({ where: { id } })).count;
