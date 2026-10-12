import "server-only";
// Private to the screening module: only service.ts imports this.
import { prisma, type ScreeningConfig, type ScreeningEntry } from "@aboutselphy/db";

export const readConfig = (): Promise<ScreeningConfig> => prisma.screeningConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export type ConfigData = { enabled: boolean; channelId: string | null; approvedRoleId: string | null; pendingRoleId: string | null };
export const updateConfig = (data: ConfigData): Promise<ScreeningConfig> => prisma.screeningConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

/** Pending first (oldest waiting first), then the most recent decisions. */
export async function listEntries(): Promise<ScreeningEntry[]> {
  const [pending, decided] = await Promise.all([
    prisma.screeningEntry.findMany({ where: { status: "pending" }, orderBy: { joinedAt: "asc" }, take: 100 }),
    prisma.screeningEntry.findMany({ where: { status: { not: "pending" } }, orderBy: { joinedAt: "desc" }, take: 50 }),
  ]);
  return [...pending, ...decided];
}
