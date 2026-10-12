// Private to the antibot module: only service.ts and config.ts import this.
import { prisma, type AntiBotConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<AntiBotConfig> => prisma.antiBotConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

/** Counts a caught member (for the dashboard). */
export const recordHit = () => prisma.antiBotConfig.update({ where: { id: 1 }, data: { hits: { increment: 1 }, lastHitAt: new Date() } });
