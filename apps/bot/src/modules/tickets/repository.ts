// Private to the tickets module: only config.ts, service.ts and interactions.ts import this.
import { prisma, type Prisma, type Ticket, type TicketConfig } from "@aboutselphy/db";

export function readConfig(): Promise<TicketConfig> {
  return prisma.ticketConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function setPanelMessage(panelChannelId: string, panelMessageId: string) {
  return prisma.ticketConfig.update({ where: { id: 1 }, data: { panelChannelId, panelMessageId } });
}

/** The number the next ticket gets. Incremented atomically, so two tickets at once never share one (a failed open leaves a gap). */
export async function reserveNumber(): Promise<number> {
  const row = await prisma.ticketConfig.upsert({ where: { id: 1 }, update: { nextNumber: { increment: 1 } }, create: { id: 1, nextNumber: 2 }, select: { nextNumber: true } });
  return row.nextNumber - 1;
}

export function createTicket(data: { number: number; channelId: string; openerId: string; openerName: string; topic: string; categoryId: string | null; categoryLabel: string }) {
  return prisma.ticket.create({ data: { ...data, openerName: data.openerName.slice(0, 100), topic: data.topic.slice(0, 300), categoryLabel: data.categoryLabel.slice(0, 80) } });
}

export const listCategories = () => prisma.ticketCategory.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
export const findCategory = (id: string) => prisma.ticketCategory.findUnique({ where: { id } });

/** The opener rates a closed ticket, once: one conditional UPDATE, and only the opener's own ticket. Returns false if it was rated already or isn't theirs. */
export async function rate(ticketId: string, openerId: string, stars: number): Promise<boolean> {
  const { count } = await prisma.ticket.updateMany({ where: { id: ticketId, openerId, status: "closed", rating: null }, data: { rating: stars } });
  return count > 0;
}

/** A message was written in an open ticket's channel. */
export const touchActivity = (channelId: string) => prisma.ticket.updateMany({ where: { channelId, status: "open" }, data: { lastActivityAt: new Date() } });

/** Open tickets with no message since `cut`. */
export const listIdle = (cut: Date) => prisma.ticket.findMany({ where: { status: "open", lastActivityAt: { lt: cut } } });

export const findTicket = (id: string) => prisma.ticket.findUnique({ where: { id } });
export const findByChannel = (channelId: string) => prisma.ticket.findUnique({ where: { channelId } });
export const openCountFor = (openerId: string) => prisma.ticket.count({ where: { openerId, status: "open" } });
export const listOpen = () => prisma.ticket.findMany({ where: { status: "open" } });

/** Closed tickets whose channel may still exist (the bot stopped before deleting it). */
export const listRecentlyClosed = (since: Date) => prisma.ticket.findMany({ where: { status: "closed", closedAt: { gte: since } } });

export const claimedCountFor = (staffId: string) => prisma.ticket.count({ where: { claimedById: staffId, status: "open" } });

export async function claim(id: string, by: { id: string; name: string }): Promise<boolean> {
  const { count } = await prisma.ticket.updateMany({ where: { id, status: "open", claimedById: null }, data: { claimedById: by.id, claimedByName: by.name.slice(0, 100) } });
  return count > 0;
}

/** open -> closed in one conditional update, so two clicks can't both close it. Returns false if it already was. */
export async function markClosed(
  id: string,
  data: { closedById: string | null; closedByName: string | null; closeReason: string; transcript: Prisma.InputJsonValue | null; messageCount: number },
): Promise<boolean> {
  const { count } = await prisma.ticket.updateMany({
    where: { id, status: "open" },
    data: { status: "closed", closedAt: new Date(), closedById: data.closedById, closedByName: data.closedByName?.slice(0, 100) ?? null, closeReason: data.closeReason.slice(0, 300), messageCount: data.messageCount, ...(data.transcript === null ? {} : { transcript: data.transcript }) },
  });
  return count > 0;
}

export type { Ticket };
