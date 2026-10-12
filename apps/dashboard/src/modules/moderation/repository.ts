import "server-only";
// Private to the moderation module: only service.ts imports this.
import { prisma, type ModCase, type ModConfig, type Prisma } from "@aboutselphy/db";
import { caseWhere } from "./case-filter";
import { PAGE_SIZE, type CaseQuery } from "./schema";

export async function listCases(query: CaseQuery): Promise<{ rows: ModCase[]; total: number }> {
  const where = caseWhere(query);
  const [rows, total] = await Promise.all([
    prisma.modCase.findMany({
      where,
      orderBy: { caseNumber: "desc" },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.modCase.count({ where }),
  ]);
  return { rows, total };
}

export function findCase(caseNumber: number) {
  return prisma.modCase.findUnique({ where: { caseNumber } });
}

export function listCasesForTarget(targetId: string, excludeCaseNumber: number, take: number) {
  return prisma.modCase.findMany({
    where: { targetId, caseNumber: { not: excludeCaseNumber } },
    orderBy: { caseNumber: "desc" },
    take,
  });
}

export function recentCases(take: number) {
  return prisma.modCase.findMany({ orderBy: { caseNumber: "desc" }, take });
}

/** Case counts per type since `since`, plus the warnings that are still active. */
export async function caseStats(since: Date) {
  const [byType, activeWarnings] = await Promise.all([
    prisma.modCase.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.modCase.count({ where: { type: "warn", active: true } }),
  ]);
  return { byType: byType.map((r) => ({ type: r.type, count: r._count._all })), activeWarnings };
}

export function readConfig(): Promise<ModConfig> {
  return prisma.modConfig.findUniqueOrThrow({ where: { id: 1 } });
}

export function updateConfig(data: {
  logChannelId: string | null;
  dmOnAction: boolean;
  escalationThreshold: number | null;
  escalationAction: "timeout" | "kick" | "ban" | null;
  escalationDurationSeconds: number | null;
  escalationWindowDays: number | null;
}) {
  return prisma.modConfig.update({ where: { id: 1 }, data });
}

/**
 * Only an active warning can be pardoned, and the row records who did it.
 * The condition is part of the UPDATE, so two moderators clicking at once
 * can't both succeed. Returns how many rows changed (0 or 1).
 */
export async function pardonWarning(
  caseNumber: number,
  by: { userId: string; name: string },
): Promise<number> {
  const { count } = await prisma.modCase.updateMany({
    where: { caseNumber, type: "warn", active: true },
    data: { active: false, pardonedAt: new Date(), pardonedByUserId: by.userId, pardonedByName: by.name.slice(0, 100) },
  });
  return count;
}

/** Changes a case's reason and records who did it and when. Returns how many rows changed (0 or 1). */
export async function editReason(caseNumber: number, reason: string | null, by: string): Promise<number> {
  const { count } = await prisma.modCase.updateMany({ where: { caseNumber }, data: { reason, reasonEditedAt: new Date(), reasonEditedByName: by.slice(0, 100) } });
  return count;
}

/** Up to `take` cases matching the filter, newest first, for the CSV export. */
export function exportCases(where: Prisma.ModCaseWhereInput, take: number) {
  return prisma.modCase.findMany({ where, orderBy: { caseNumber: "desc" }, take });
}

/** Cases per moderator since `since`: the Discord moderators, the dashboard's staff (by name) and the bot's automatic ones. */
export async function moderatorStats(since: Date) {
  const rows = await prisma.modCase.groupBy({ by: ["moderatorId", "moderatorName"], where: { createdAt: { gte: since } }, _count: { _all: true } });
  const merged = new Map<string, { key: string; name: string | null; automatic: boolean; count: number }>();
  for (const r of rows) {
    // Dashboard cases share one id, so they are told apart by the staff member's name.
    const key = r.moderatorId === "dashboard" ? `dashboard:${r.moderatorName ?? "?"}` : r.moderatorId;
    const current = merged.get(key);
    merged.set(key, { key, name: r.moderatorName ?? current?.name ?? null, automatic: r.moderatorId === "system", count: (current?.count ?? 0) + r._count._all });
  }
  return [...merged.values()].sort((a, b) => b.count - a.count);
}
