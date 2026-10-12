// Private to the screening module: only config.ts and service.ts import this.
import { prisma, type ScreeningConfig, type ScreeningEntry } from "@aboutselphy/db";
import type { EntryStatus } from "./rules";

export const readConfig = (): Promise<ScreeningConfig> => prisma.screeningConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const createEntry = (data: { userId: string; userName: string; accountCreatedAt: Date; channelId: string }): Promise<ScreeningEntry> => prisma.screeningEntry.create({ data });

export const setCard = (id: string, messageId: string) => prisma.screeningEntry.update({ where: { id }, data: { messageId } });

export const findEntry = (id: string): Promise<ScreeningEntry | null> => prisma.screeningEntry.findUnique({ where: { id } });

/** One conditional UPDATE: only a pending entry changes, so two staff clicking at once decide it once. True if this call won. */
export async function decide(id: string, status: EntryStatus, byName: string): Promise<boolean> {
  const { count } = await prisma.screeningEntry.updateMany({ where: { id, status: "pending" }, data: { status, decidedByName: byName, decidedAt: new Date() } });
  return count === 1;
}

/** A member left while waiting: the pending entries of that user become "left". Returns the affected entries. */
export async function markLeft(userId: string): Promise<ScreeningEntry[]> {
  const pending = await prisma.screeningEntry.findMany({ where: { userId, status: "pending" } });
  if (pending.length === 0) return [];
  await prisma.screeningEntry.updateMany({ where: { userId, status: "pending" }, data: { status: "left", decidedAt: new Date() } });
  return pending;
}

export const hasPending = async (userId: string): Promise<boolean> => (await prisma.screeningEntry.count({ where: { userId, status: "pending" } })) > 0;
