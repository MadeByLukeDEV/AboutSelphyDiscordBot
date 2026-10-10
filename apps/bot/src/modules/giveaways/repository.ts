// Private to the giveaways module: only service.ts and interactions.ts import this.
import { prisma } from "@aboutselphy/db";

export const find = (id: string) => prisma.giveaway.findUnique({ where: { id } });

/** draft -> active in one conditional update (so two starts can't both post). */
export async function activate(id: string, messageId: string): Promise<boolean> {
  const { count } = await prisma.giveaway.updateMany({ where: { id, status: "draft" }, data: { status: "active", messageId } });
  return count > 0;
}

/** active -> ended in one conditional update; whoever wins this race does the draw. */
export async function claimEnd(id: string): Promise<boolean> {
  const { count } = await prisma.giveaway.updateMany({ where: { id, status: "active" }, data: { status: "ended", endedAt: new Date() } });
  return count > 0;
}

export async function cancel(id: string): Promise<boolean> {
  const { count } = await prisma.giveaway.updateMany({ where: { id, status: { in: ["draft", "active"] } }, data: { status: "cancelled", endedAt: new Date() } });
  return count > 0;
}

export const setWinners = (id: string, winners: string[]) => prisma.giveaway.update({ where: { id }, data: { winners } });
export const listDue = (now: Date) => prisma.giveaway.findMany({ where: { status: "active", endsAt: { lte: now } }, orderBy: { endsAt: "asc" }, take: 10 });

/** Enter, or leave if already in. Returns whether the member is in afterwards. */
export async function toggleEntry(giveawayId: string, userId: string): Promise<boolean> {
  const removed = await prisma.giveawayEntry.deleteMany({ where: { giveawayId, userId } });
  if (removed.count > 0) return false;
  await prisma.giveawayEntry.createMany({ data: [{ giveawayId, userId }], skipDuplicates: true });
  return true;
}

export const countEntries = (giveawayId: string) => prisma.giveawayEntry.count({ where: { giveawayId } });
export async function entryUserIds(giveawayId: string): Promise<string[]> {
  return (await prisma.giveawayEntry.findMany({ where: { giveawayId }, select: { userId: true } })).map((e) => e.userId);
}
