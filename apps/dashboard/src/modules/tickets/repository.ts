import "server-only";
// Private to the tickets module: only service.ts imports this.
import { prisma, type Ticket, type TicketConfig } from "@aboutselphy/db";

export function readConfig(): Promise<TicketConfig> {
  return prisma.ticketConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export type ConfigData = {
  enabled: boolean;
  panelChannelId: string | null;
  categoryId: string | null;
  logChannelId: string | null;
  staffRoleIds: string[];
  maxOpenPerUser: number;
  askReason: boolean;
  askRating: boolean;
  autoCloseHours: number;
  panelTitle: string;
  panelDescription: string;
  panelColor: number;
  buttonLabel: string;
  welcomeTemplate: string;
};

export function updateConfig(data: ConfigData): Promise<TicketConfig> {
  return prisma.ticketConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

/** Open tickets first, then the latest closed ones. The transcript itself is not loaded for the list; a ticket has one when messages were saved. */
export async function listTickets(closedTake: number): Promise<Array<Omit<Ticket, "transcript"> & { hasTranscript: boolean }>> {
  const select = {
    id: true, number: true, channelId: true, openerId: true, openerName: true, status: true, claimedById: true, claimedByName: true,
    createdAt: true, closedAt: true, closedById: true, closedByName: true, closeReason: true, messageCount: true, topic: true, lastActivityAt: true, categoryLabel: true, rating: true, categoryId: true,
  } as const;
  const [open, closed] = await Promise.all([
    prisma.ticket.findMany({ where: { status: "open" }, orderBy: { number: "desc" }, select }),
    prisma.ticket.findMany({ where: { status: "closed" }, orderBy: { number: "desc" }, take: closedTake, select }),
  ]);
  return [...open, ...closed].map((t) => ({ ...t, hasTranscript: t.messageCount > 0 }));
}

export function findByNumber(number: number): Promise<Ticket | null> {
  return prisma.ticket.findUnique({ where: { number } });
}

export const listCategories = () => prisma.ticketCategory.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });

/** Average rating and how many tickets were rated. */
export async function ratingStats() {
  const r = await prisma.ticket.aggregate({ where: { rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } });
  return { average: r._avg.rating, count: r._count.rating };
}

export type CategoryData = { id?: string; label: string; emoji: string; discordCategoryId: string | null; staffRoleIds: string[] };

/**
 * Replaces the category list in one transaction while keeping the ids of the ones that stay (their panel buttons and open
 * tickets point at them): the others are removed, existing ones are updated, new ones are created. The order is the list's order.
 */
export async function replaceCategories(list: CategoryData[]): Promise<void> {
  const keep = list.map((c) => c.id).filter((id): id is string => Boolean(id));
  await prisma.$transaction([
    prisma.ticketCategory.deleteMany({ where: { id: { notIn: keep } } }),
    ...list.map((c, position) =>
      c.id
        ? prisma.ticketCategory.update({ where: { id: c.id }, data: { label: c.label, emoji: c.emoji, discordCategoryId: c.discordCategoryId, staffRoleIds: c.staffRoleIds, position } })
        : prisma.ticketCategory.create({ data: { label: c.label, emoji: c.emoji, discordCategoryId: c.discordCategoryId, staffRoleIds: c.staffRoleIds, position } }),
    ),
  ]);
}
