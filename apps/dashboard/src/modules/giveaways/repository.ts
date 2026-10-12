import "server-only";
// Private to the giveaways module: only service.ts imports this.
import { prisma, type Giveaway } from "@aboutselphy/db";

export type GiveawayWithCount = Giveaway & { _count: { entries: number } };

export function listGiveaways(): Promise<GiveawayWithCount[]> {
  return prisma.giveaway.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { entries: true } } } });
}

export const findGiveaway = (id: string) => prisma.giveaway.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } });

export type GiveawayData = {
  channelId: string;
  prize: string;
  description: string;
  imageUrl: string;
  winnerCount: number;
  endsAt: Date;
  requiredRoleId: string | null;
  pingRoleId: string | null;
  bonusRoleId: string | null;
  bonusEntries: number;
  minAccountDays: number;
  minMemberDays: number;
  minLevel: number;
  repeatsLeft: number;
};

export function createGiveaway(data: GiveawayData, by: { userId: string; name: string }) {
  return prisma.giveaway.create({ data: { ...data, hostUserId: by.userId, hostName: by.name.slice(0, 100) }, include: { _count: { select: { entries: true } } } });
}

/** Only a draft can be edited; the condition is part of the UPDATE so it can't change a giveaway the bot just started. */
export async function updateDraft(id: string, data: GiveawayData): Promise<boolean> {
  return (await prisma.giveaway.updateMany({ where: { id, status: "draft" }, data })).count > 0;
}

/** Drafts, ended and cancelled giveaways can be removed (a running one must be cancelled or ended first). */
export async function deleteInactive(id: string): Promise<boolean> {
  return (await prisma.giveaway.deleteMany({ where: { id, status: { not: "active" } } })).count > 0;
}
