import "server-only";
// Private to the polls module: only service.ts imports this.
import { prisma, type Poll } from "@aboutselphy/db";

export type PollWithVotes = Poll & { counts: number[]; voters: number };

export async function listPolls(): Promise<PollWithVotes[]> {
  const polls = await prisma.poll.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  if (polls.length === 0) return [];
  const ids = polls.map((p) => p.id);
  const [grouped, voters] = await Promise.all([
    prisma.pollVote.groupBy({ by: ["pollId", "optionIndex"], where: { pollId: { in: ids } }, _count: { _all: true } }),
    prisma.pollVote.groupBy({ by: ["pollId", "userId"], where: { pollId: { in: ids } } }),
  ]);
  return polls.map((p) => {
    const counts = new Array<number>(p.options.length).fill(0);
    for (const g of grouped) if (g.pollId === p.id && g.optionIndex < counts.length) counts[g.optionIndex] = g._count._all;
    return { ...p, counts, voters: voters.filter((v) => v.pollId === p.id).length };
  });
}

export const findPoll = (id: string) => prisma.poll.findUnique({ where: { id } });

export function createPoll(data: { channelId: string; question: string; options: string[]; multiple: boolean; imageUrl: string; endsAt: Date | null }, by: { userId: string; name: string }) {
  return prisma.poll.create({ data: { ...data, createdById: by.userId, createdByName: by.name.slice(0, 100) } });
}

/** A running poll must be ended first, so its post and the end job stay consistent. */
export async function deleteInactive(id: string): Promise<boolean> {
  return (await prisma.poll.deleteMany({ where: { id, status: { not: "active" } } })).count > 0;
}
