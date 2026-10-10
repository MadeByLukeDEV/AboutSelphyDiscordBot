// Private to the counting module: only service.ts imports this.
import { prisma, type CountingConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<CountingConfig> => prisma.countingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

/**
 * Accepts a number only if the stored count is still the one it was judged against (one
 * conditional UPDATE, so two members posting the same number at once can't both count).
 * The high score moves in the same statement, which the table's CHECK (highScore >= currentCount) needs.
 */
export async function acceptNumber(previous: number, number: number, userId: string): Promise<boolean> {
  const changed = await prisma.$executeRaw`UPDATE "CountingConfig" SET "currentCount" = ${number}, "lastUserId" = ${userId}, "highScore" = GREATEST("highScore", ${number}), "updatedAt" = now() WHERE "id" = 1 AND "currentCount" = ${previous}`;
  return changed > 0;
}

/** A mistake: the streak ends (the high score stays). */
export async function resetCount(): Promise<void> {
  await prisma.countingConfig.updateMany({ where: { id: 1 }, data: { currentCount: 0, lastUserId: null } });
}
