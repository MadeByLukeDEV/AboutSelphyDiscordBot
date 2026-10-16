// Private to the polls module: only service.ts, interactions.ts and commands.ts import this.
import { prisma } from "@aboutselphy/db";

export const find = (id: string) => prisma.poll.findUnique({ where: { id } });

export function create(data: { channelId: string; question: string; options: string[]; multiple: boolean; imageUrl: string; endsAt: Date | null; createdById: string; createdByName: string }) {
  return prisma.poll.create({ data: { ...data, createdByName: data.createdByName.slice(0, 100) } });
}

/** draft -> active in one conditional update, so two starts can't both post. */
export async function activate(id: string, messageId: string): Promise<boolean> {
  return (await prisma.poll.updateMany({ where: { id, status: "draft" }, data: { status: "active", messageId, startedAt: new Date() } })).count > 0;
}

/** active -> ended in one conditional update. */
export async function claimEnd(id: string): Promise<boolean> {
  return (await prisma.poll.updateMany({ where: { id, status: "active" }, data: { status: "ended", endedAt: new Date() } })).count > 0;
}

export const listDue = (now: Date) => prisma.poll.findMany({ where: { status: "active", endsAt: { lte: now } }, take: 10 });

export async function selection(pollId: string, userId: string): Promise<Set<number>> {
  return new Set((await prisma.pollVote.findMany({ where: { pollId, userId }, select: { optionIndex: true } })).map((v) => v.optionIndex));
}

/** Replaces the member's choices with `next` in one transaction. */
export async function setSelection(pollId: string, userId: string, next: Set<number>): Promise<void> {
  await prisma.$transaction([
    prisma.pollVote.deleteMany({ where: { pollId, userId } }),
    ...(next.size > 0 ? [prisma.pollVote.createMany({ data: [...next].map((optionIndex) => ({ pollId, userId, optionIndex })) })] : []),
  ]);
}

export const allVotes = (pollId: string) => prisma.pollVote.findMany({ where: { pollId }, select: { userId: true, optionIndex: true, createdAt: true } });

/** Active polls that might need a reminder (the exact window is decided by `reminderDue`). */
export const listReminderCandidates = () => prisma.poll.findMany({ where: { status: "active", remindBeforeMinutes: { gt: 0 }, reminderSentAt: null, endsAt: { not: null } }, take: 20 });

/** One conditional UPDATE: only the call that still sees "not sent" wins, so the reminder is posted once. */
export async function claimReminder(id: string): Promise<boolean> {
  return (await prisma.poll.updateMany({ where: { id, status: "active", reminderSentAt: null }, data: { reminderSentAt: new Date() } })).count > 0;
}
