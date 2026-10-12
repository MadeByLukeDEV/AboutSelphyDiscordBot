// Private to the suggestions module: only config.ts, service.ts and interactions.ts import this.
import { prisma, type Suggestion, type SuggestionConfig } from "@aboutselphy/db";
import type { Decision } from "@aboutselphy/shared/suggestions";
import type { VoteValue } from "./rules";

export function readConfig(): Promise<SuggestionConfig> {
  return prisma.suggestionConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** The number the next suggestion gets. Incremented atomically, so two at once never share one. */
export async function reserveNumber(): Promise<number> {
  const row = await prisma.suggestionConfig.upsert({ where: { id: 1 }, update: { nextNumber: { increment: 1 } }, create: { id: 1, nextNumber: 2 }, select: { nextNumber: true } });
  return row.nextNumber - 1;
}

export function create(data: { number: number; authorId: string; authorName: string; content: string; channelId: string; messageId: string }) {
  return prisma.suggestion.create({ data: { ...data, authorName: data.authorName.slice(0, 100) } });
}

export const find = (id: string) => prisma.suggestion.findUnique({ where: { id } });
export const findByNumber = (number: number) => prisma.suggestion.findUnique({ where: { number } });

export async function lastCreatedAt(authorId: string): Promise<Date | null> {
  return (await prisma.suggestion.findFirst({ where: { authorId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null;
}

export async function currentVote(suggestionId: string, userId: string): Promise<VoteValue | null> {
  const row = await prisma.suggestionVote.findUnique({ where: { suggestionId_userId: { suggestionId, userId } } });
  return row ? (row.value === 1 ? 1 : -1) : null;
}

/** Sets the member's vote (or removes it for null). */
export async function setVote(suggestionId: string, userId: string, value: VoteValue | null): Promise<void> {
  if (value === null) await prisma.suggestionVote.deleteMany({ where: { suggestionId, userId } });
  else await prisma.suggestionVote.upsert({ where: { suggestionId_userId: { suggestionId, userId } }, update: { value }, create: { suggestionId, userId, value } });
}

export async function counts(suggestionId: string): Promise<{ up: number; down: number }> {
  const [up, down] = await Promise.all([prisma.suggestionVote.count({ where: { suggestionId, value: 1 } }), prisma.suggestionVote.count({ where: { suggestionId, value: -1 } })]);
  return { up, down };
}

/** The status change in one conditional update (from the allowed states), so two decisions can't both apply. */
export async function decide(id: string, from: Array<Suggestion["status"]>, status: Decision, by: { id: string | null; name: string }, reason: string): Promise<boolean> {
  const { count } = await prisma.suggestion.updateMany({
    where: { id, status: { in: from } },
    data: { status, decidedById: by.id, decidedByName: by.name.slice(0, 100), decisionReason: reason.slice(0, 300), decidedAt: new Date() },
  });
  return count > 0;
}

/** Copies the votes of `fromId` to `toId` for members who haven't voted there yet; returns how many moved. */
export async function copyVotes(fromId: string, toId: string): Promise<number> {
  const votes = await prisma.suggestionVote.findMany({ where: { suggestionId: fromId } });
  if (votes.length === 0) return 0;
  const { count } = await prisma.suggestionVote.createMany({ data: votes.map((v) => ({ suggestionId: toId, userId: v.userId, value: v.value })), skipDuplicates: true });
  return count;
}

export const setMergedInto = (id: string, number: number) => prisma.suggestion.update({ where: { id }, data: { mergedIntoNumber: number } });
