import "server-only";
import { prisma } from "@aboutselphy/db";

export type Attention = { screening: number; tickets: number; suggestions: number; giveaways: number; polls: number };

/**
 * What is waiting for a person right now, for the overview. Read-only counts straight from the bot's tables (a failing query shows 0
 * for that item instead of breaking the page). Every item points to a page that all staff may open.
 */
export async function getAttention(): Promise<Attention> {
  const count = (job: Promise<number>) => job.catch(() => 0);
  const [screening, tickets, suggestions, giveaways, polls] = await Promise.all([
    count(prisma.screeningEntry.count({ where: { status: "pending" } })),
    count(prisma.ticket.count({ where: { status: "open", claimedById: null } })),
    count(prisma.suggestion.count({ where: { status: "open" } })),
    count(prisma.giveaway.count({ where: { status: "active" } })),
    count(prisma.poll.count({ where: { status: "active" } })),
  ]);
  return { screening, tickets, suggestions, giveaways, polls };
}
