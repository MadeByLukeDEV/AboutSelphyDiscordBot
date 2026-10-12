// Private to the raid module: only config.ts and service.ts import this.
import { prisma, type RaidConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<RaidConfig> => prisma.raidConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

/** Raid mode on until `until` (and remembers when this raid began). */
export const startRaid = (until: Date) => prisma.raidConfig.update({ where: { id: 1 }, data: { activeUntil: until, lastRaidAt: new Date() } });

/** Raid mode off. Returns true if it was on (so only one caller announces the end). */
export async function endRaid(): Promise<boolean> {
  const { count } = await prisma.raidConfig.updateMany({ where: { id: 1, activeUntil: { not: null } }, data: { activeUntil: null } });
  return count > 0;
}
