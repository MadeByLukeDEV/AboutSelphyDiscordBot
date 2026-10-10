// Private to the birthdays module: only config.ts, service.ts and commands.ts import this.
import { prisma, type Birthday, type BirthdayConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<BirthdayConfig> => prisma.birthdayConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function saveBirthday(userId: string, displayName: string, month: number, day: number) {
  const data = { displayName: displayName.slice(0, 100), month, day };
  // A changed date can be celebrated again this year, so the "already greeted" mark is cleared.
  return prisma.birthday.upsert({ where: { userId }, update: { ...data, lastCelebratedOn: null }, create: { userId, ...data } });
}

export const findBirthday = (userId: string): Promise<Birthday | null> => prisma.birthday.findUnique({ where: { userId } });

export const removeBirthday = (userId: string) => prisma.birthday.deleteMany({ where: { userId } });

export const allBirthdays = (): Promise<Birthday[]> => prisma.birthday.findMany();

/** Marks a member as greeted for `dateKey`. False when already marked, so a restart or two rounds never greet twice. */
export async function claimDay(userId: string, dateKey: string): Promise<boolean> {
  const result = await prisma.birthday.updateMany({ where: { userId, OR: [{ lastCelebratedOn: null }, { lastCelebratedOn: { not: dateKey } }] }, data: { lastCelebratedOn: dateKey } });
  return result.count > 0;
}
