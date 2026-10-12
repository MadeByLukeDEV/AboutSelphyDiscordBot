// Private to the announcements module: only service.ts imports this.
import { prisma, type Announcement } from "@aboutselphy/db";

/** Announcements whose time has come. */
export function listDue(now: Date, take = 10): Promise<Announcement[]> {
  return prisma.announcement.findMany({ where: { status: "scheduled", scheduledFor: { lte: now } }, orderBy: { scheduledFor: "asc" }, take });
}

/** scheduled -> sending, atomically. False if another round (or process) already took it. */
export async function claim(id: string): Promise<boolean> {
  const { count } = await prisma.announcement.updateMany({ where: { id, status: "scheduled" }, data: { status: "sending" } });
  return count > 0;
}

export function markSent(id: string, messageId: string, at: Date) {
  return prisma.announcement.update({ where: { id }, data: { status: "sent", messageId, sentAt: at, lastError: "" } });
}

export function markFailed(id: string, code: string) {
  return prisma.announcement.update({ where: { id }, data: { status: "failed", lastError: code } });
}

/**
 * A row stuck in "sending" means the bot stopped in the middle of posting it. It may
 * or may not have reached Discord, so it is marked failed (a person decides), never
 * sent again automatically.
 */
export async function failStuck(olderThan: Date): Promise<number> {
  const { count } = await prisma.announcement.updateMany({
    where: { status: "sending", updatedAt: { lt: olderThan } },
    data: { status: "failed", lastError: "interrupted" },
  });
  return count;
}

export function find(id: string): Promise<Announcement | null> {
  return prisma.announcement.findUnique({ where: { id } });
}

/** A recurring announcement was posted: remember the message and schedule the next round. Only from "sending", so it happens once. */
export async function markRescheduled(id: string, messageId: string, at: Date, next: Date): Promise<boolean> {
  const { count } = await prisma.announcement.updateMany({ where: { id, status: "sending" }, data: { status: "scheduled", messageId, sentAt: at, scheduledFor: next, lastError: "" } });
  return count > 0;
}
