import "server-only";
// Private to the memberoverview module: only service.ts imports this.
import { prisma, type MemberOverview } from "@aboutselphy/db";

export const readOverview = (): Promise<MemberOverview> => prisma.memberOverview.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateOverview(data: { channelId: string | null; language: string; color: string }): Promise<MemberOverview> {
  return prisma.memberOverview.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

/** The posted messages are somewhere else now (the channel changed): forget them so the next post starts fresh. */
export const forgetMessages = () => prisma.memberOverview.update({ where: { id: 1 }, data: { messageIds: [], postedAt: null } });
