// Private to the modguide module: only service.ts imports this.
import { prisma, type ModGuide } from "@aboutselphy/db";

/** The singleton row, created with its defaults on first read. */
export const readGuide = (): Promise<ModGuide> => prisma.modGuide.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

export const setPosted = (messageIds: string[]) => prisma.modGuide.update({ where: { id: 1 }, data: { messageIds, postedAt: new Date() } });
