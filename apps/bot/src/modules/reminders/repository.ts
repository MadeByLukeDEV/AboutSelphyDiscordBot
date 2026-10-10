// Private to the reminders module: only config.ts, service.ts and commands.ts import this.
import { prisma, type Reminder, type ReminderConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<ReminderConfig> => prisma.reminderConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const pendingCount = (userId: string) => prisma.reminder.count({ where: { userId, deliveredAt: null } });

export const createReminder = (data: { userId: string; channelId: string; message: string; remindAt: Date }) => prisma.reminder.create({ data });

export const listPending = (userId: string): Promise<Reminder[]> => prisma.reminder.findMany({ where: { userId, deliveredAt: null }, orderBy: { remindAt: "asc" }, take: 50 });

/** Cancels one of the member's own pending reminders. False when it doesn't exist, is someone else's or was delivered. */
export async function cancelReminder(id: string, userId: string): Promise<boolean> {
  return (await prisma.reminder.deleteMany({ where: { id, userId, deliveredAt: null } })).count > 0;
}

export const listDue = (now: Date): Promise<Reminder[]> => prisma.reminder.findMany({ where: { deliveredAt: null, remindAt: { lte: now } }, orderBy: { remindAt: "asc" }, take: 50 });

/** Claims delivery in one conditional update, so a reminder is never delivered twice. */
export async function claimDelivery(id: string): Promise<boolean> {
  return (await prisma.reminder.updateMany({ where: { id, deliveredAt: null }, data: { deliveredAt: new Date() } })).count > 0;
}

/** Delivered reminders are kept for a day, then removed. */
export const pruneDelivered = (before: Date) => prisma.reminder.deleteMany({ where: { deliveredAt: { not: null, lt: before } } });

export const forgetUser = (userId: string) => prisma.reminder.deleteMany({ where: { userId } });
