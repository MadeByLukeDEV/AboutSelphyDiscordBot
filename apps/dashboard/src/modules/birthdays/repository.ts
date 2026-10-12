import "server-only";
// Private to the birthdays module: only service.ts imports this.
import { prisma, type BirthdayConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<BirthdayConfig> => prisma.birthdayConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateConfig(data: { enabled: boolean; channelId: string | null; roleId: string | null; message: string; timeZone: string; cardEnabled: boolean; cardMode: string; cardTitle: string; cardSubtitle: string; milestoneMessage: string; monthlySummary: boolean; lastSummaryMonth?: null }): Promise<BirthdayConfig> {
  return prisma.birthdayConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

export const allBirthdays = () => prisma.birthday.findMany();

export function saveBirthdayRow(userId: string, displayName: string, month: number, day: number, year: number | null) {
  const data = { displayName: displayName.slice(0, 100), month, day, year };
  return prisma.birthday.upsert({ where: { userId }, update: { ...data, lastCelebratedOn: null }, create: { userId, ...data } });
}

export const deleteBirthdayRow = async (userId: string) => (await prisma.birthday.deleteMany({ where: { userId } })).count;
