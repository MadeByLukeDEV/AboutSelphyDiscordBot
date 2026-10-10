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
  const rows = await prisma.suggestion.findMany({ where: status ? { status } : {}, orderBy: { number: "desc" }, take });
  const votes = await prisma.suggestionVote.groupBy({ by: ["suggestionId", "value"], where: { suggestionId: { in: rows.map((r) => r.id) } }, _count: { _all: true } });
  const count = (id: string, value: number) => votes.find((v) => v.suggestionId === id && v.value === value)?._count._all ?? 0;
  return rows.map((r) => ({ ...r, up: count(r.id, 1), down: count(r.id, -1) }));
}

export function countByStatus() {
  return prisma.suggestion.groupBy({ by: ["status"], _count: { _all: true } });
}
