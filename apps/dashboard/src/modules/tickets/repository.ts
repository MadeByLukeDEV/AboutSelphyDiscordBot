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
    createdAt: true, closedAt: true, closedById: true, closedByName: true, closeReason: true, messageCount: true,
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
