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

export function createTicket(data: { number: number; channelId: string; openerId: string; openerName: string }) {
  return prisma.ticket.create({ data: { ...data, openerName: data.openerName.slice(0, 100) } });
}

export const findTicket = (id: string) => prisma.ticket.findUnique({ where: { id } });
export const findByChannel = (channelId: string) => prisma.ticket.findUnique({ where: { channelId } });
export const openCountFor = (openerId: string) => prisma.ticket.count({ where: { openerId, status: "open" } });
export const listOpen = () => prisma.ticket.findMany({ where: { status: "open" } });

/** Closed tickets whose channel may still exist (the bot stopped before deleting it). */
export const listRecentlyClosed = (since: Date) => prisma.ticket.findMany({ where: { status: "closed", closedAt: { gte: since } } });

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
