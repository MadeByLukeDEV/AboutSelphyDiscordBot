import "server-only";
// Private to the modules module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

export const listFlags = () => prisma.moduleFlag.findMany();
export const setFlag = (key: string, enabled: boolean, by: string) => prisma.moduleFlag.upsert({ where: { key }, update: { enabled, updatedByName: by }, create: { key, enabled, updatedByName: by } });
