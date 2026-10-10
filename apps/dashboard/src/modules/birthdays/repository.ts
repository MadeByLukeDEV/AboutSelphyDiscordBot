import "server-only";
// Private to the birthdays module: only service.ts imports this.
import { prisma, type BirthdayConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<BirthdayConfig> => prisma.birthdayConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateConfig(data: { enabled: boolean; channelId: string | null; roleId: string | null; message: string; timeZone: string; cardEnabled: boolean; cardMode: string; cardTitle: string; cardSubtitle: string }): Promise<BirthdayConfig> {
  return prisma.birthdayConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

export const allBirthdays = () => prisma.birthday.findMany();
