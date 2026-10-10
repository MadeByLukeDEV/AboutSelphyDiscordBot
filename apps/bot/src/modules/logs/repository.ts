// Private to the logs module: only events.ts imports this.
import { prisma } from "@aboutselphy/db";

/** The open ticket that lives in this channel, if any (ticket channels are private and never logged). */
export const findOpenTicket = (channelId: string) => prisma.ticket.findFirst({ where: { channelId, status: "open" }, select: { id: true } });
