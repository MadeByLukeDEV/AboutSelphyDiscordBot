import "server-only";
// Private to the counting module: only service.ts imports this.
import { prisma, type CountingConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<CountingConfig> => prisma.countingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const updateConfig = (data: { enabled: boolean; channelId: string | null; allowConsecutive: boolean; resetOnMistake: boolean }): Promise<CountingConfig> => prisma.countingConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

/** Starts over from 0; the high score stays. */
export const resetCount = () => prisma.countingConfig.updateMany({ where: { id: 1 }, data: { currentCount: 0, lastUserId: null } });
