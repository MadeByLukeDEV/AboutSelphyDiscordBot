import "server-only";
// Private to the reminders module: only service.ts imports this.
import { prisma, type ReminderConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<ReminderConfig> => prisma.reminderConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const updateConfig = (data: { enabled: boolean; maxPerUser: number; channelId: string | null; cardEnabled: boolean; cardMode: string; cardTitle: string }): Promise<ReminderConfig> => prisma.reminderConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

/** Counts only: the text of a member's reminders is private and never shown here. */
export async function stats() {
  const [pending, next] = await Promise.all([
    prisma.reminder.count({ where: { deliveredAt: null } }),
    prisma.reminder.findFirst({ where: { deliveredAt: null }, orderBy: { remindAt: "asc" }, select: { remindAt: true } }),
  ]);
  return { pending, nextAt: next?.remindAt ?? null };
}
