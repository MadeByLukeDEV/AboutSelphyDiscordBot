// Private to the memberoverview module: only service.ts imports this.
import { prisma, type MemberOverview } from "@aboutselphy/db";

/** The singleton row, created with its defaults on first read. */
export const readOverview = (): Promise<MemberOverview> => prisma.memberOverview.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

export const setPosted = (messageIds: string[]) => prisma.memberOverview.update({ where: { id: 1 }, data: { messageIds, postedAt: new Date() } });
