// Private to the giveaways module: only service.ts and interactions.ts import this.
import { prisma } from "@aboutselphy/db";

export const find = (id: string) => prisma.giveaway.findUnique({ where: { id } });

/** draft -> active in one conditional update (so two starts can't both post). */
export async function activate(id: string, messageId: string): Promise<boolean> {
  const { count } = await prisma.giveaway.updateMany({ where: { id, status: "draft" }, data: { status: "active", messageId, startedAt: new Date() } });
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

/** A level lookup for the level requirement (0 when the member has no XP yet). */
export async function xpOf(userId: string): Promise<number> {
  return (await prisma.memberXp.findUnique({ where: { userId }, select: { xp: true } }))?.xp ?? 0;
}

/** The next round of a repeating giveaway: the same settings, a fresh draft that the bot then starts. */
export function createNextRound(g: Awaited<ReturnType<typeof find>> & object, endsAt: Date) {
  return prisma.giveaway.create({
    data: {
      channelId: g.channelId,
      prize: g.prize,
      description: g.description,
      imageUrl: g.imageUrl,
      winnerCount: g.winnerCount,
      endsAt,
      requiredRoleId: g.requiredRoleId,
      pingRoleId: g.pingRoleId,
      bonusRoleId: g.bonusRoleId,
      bonusEntries: g.bonusEntries,
      minAccountDays: g.minAccountDays,
      minMemberDays: g.minMemberDays,
      minLevel: g.minLevel,
      repeatsLeft: g.repeatsLeft - 1,
      hostName: g.hostName,
      hostUserId: g.hostUserId,
    },
  });
}

/** A giveaway created from the /giveaway command (a draft the caller then starts). */
export function createFromCommand(data: { channelId: string; prize: string; winnerCount: number; endsAt: Date; requiredRoleId: string | null; repeatsLeft: number; hostName: string; hostUserId: string }) {
  return prisma.giveaway.create({ data: { ...data, hostName: data.hostName.slice(0, 100), hostUserId: data.hostUserId.slice(0, 64) } });
}

/** Active giveaways, soonest ending first (for the command's pick list). */
export const listActive = (take = 25) => prisma.giveaway.findMany({ where: { status: "active" }, orderBy: { endsAt: "asc" }, take });
export const listEnded = (take = 25) => prisma.giveaway.findMany({ where: { status: "ended" }, orderBy: { endedAt: "desc" }, take });

export const setWinners = (id: string, winners: string[]) => prisma.giveaway.update({ where: { id }, data: { winners } });
export const listDue = (now: Date) => prisma.giveaway.findMany({ where: { status: "active", endsAt: { lte: now } }, orderBy: { endsAt: "asc" }, take: 10 });

/** Enter, or leave if already in. Returns whether the member is in afterwards. */
export async function toggleEntry(giveawayId: string, userId: string): Promise<boolean> {
  const removed = await prisma.giveawayEntry.deleteMany({ where: { giveawayId, userId } });
  if (removed.count > 0) return false;
  await prisma.giveawayEntry.createMany({ data: [{ giveawayId, userId }], skipDuplicates: true });
  return true;
}

export const hasEntry = async (giveawayId: string, userId: string) => (await prisma.giveawayEntry.count({ where: { giveawayId, userId } })) > 0;
export const countEntries = (giveawayId: string) => prisma.giveawayEntry.count({ where: { giveawayId } });
export async function entryUserIds(giveawayId: string): Promise<string[]> {
  return (await prisma.giveawayEntry.findMany({ where: { giveawayId }, select: { userId: true } })).map((e) => e.userId);
}
