import "server-only";
// Private to the modguide module: only service.ts imports this.
import { prisma, type ModGuide } from "@aboutselphy/db";

export const readGuide = (): Promise<ModGuide> => prisma.modGuide.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateGuide(data: { channelId: string | null; title: string; description: string; imageUrl: string; color: string; notes: string }): Promise<ModGuide> {
  return prisma.modGuide.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

/** The posted messages are somewhere else now (the channel changed): forget them so the next post starts fresh. */
export const forgetMessages = () => prisma.modGuide.update({ where: { id: 1 }, data: { messageIds: [], postedAt: null } });
