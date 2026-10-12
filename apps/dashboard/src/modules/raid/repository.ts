import "server-only";
// Private to the raid module: only service.ts imports this.
import { prisma, type RaidConfig } from "@aboutselphy/db";
import type { RaidSettings } from "@aboutselphy/shared/entry";

export const readConfig = (): Promise<RaidConfig> => prisma.raidConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const updateConfig = (data: RaidSettings): Promise<RaidConfig> => prisma.raidConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
