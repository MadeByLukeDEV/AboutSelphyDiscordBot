import "server-only";
// Private to the suggestions module: only service.ts imports this.
import { prisma, type SuggestionConfig } from "@aboutselphy/db";
import type { SuggestionStatusName } from "@aboutselphy/shared/suggestions";

export function readConfig(): Promise<SuggestionConfig> {
  return prisma.suggestionConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function updateConfig(data: { enabled: boolean; channelId: string | null; cooldownSeconds: number }): Promise<SuggestionConfig> {
  return prisma.suggestionConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

/** The latest suggestions with their vote counts, optionally of one status. */
export async function listSuggestions(status: SuggestionStatusName | null, take: number) {
  const rows = await prisma.suggestion.findMany({ where: status ? { status } : {}, orderBy: { number: "desc" }, take, include: { comments: { orderBy: { createdAt: "asc" }, take: 50 } } });
  const votes = await prisma.suggestionVote.groupBy({ by: ["suggestionId", "value"], where: { suggestionId: { in: rows.map((r) => r.id) } }, _count: { _all: true } });
  const count = (id: string, value: number) => votes.find((v) => v.suggestionId === id && v.value === value)?._count._all ?? 0;
  return rows.map((r) => ({ ...r, up: count(r.id, 1), down: count(r.id, -1) }));
}

export function countByStatus() {
  return prisma.suggestion.groupBy({ by: ["status"], _count: { _all: true } });
}

export const countNotes = (suggestionId: string) => prisma.suggestionComment.count({ where: { suggestionId } });

export const addNote = (suggestionId: string, authorName: string, body: string) => prisma.suggestionComment.create({ data: { suggestionId, authorName: authorName.slice(0, 100), body } });

export async function deleteNote(id: string): Promise<string | null> {
  const note = await prisma.suggestionComment.findUnique({ where: { id }, select: { suggestionId: true } });
  if (!note) return null;
  await prisma.suggestionComment.delete({ where: { id } });
  return note.suggestionId;
}

export const notesOf = (suggestionId: string) => prisma.suggestionComment.findMany({ where: { suggestionId }, orderBy: { createdAt: "asc" }, take: 50 });

export const suggestionExists = async (id: string): Promise<boolean> => (await prisma.suggestion.count({ where: { id } })) > 0;
