import "server-only";
// Private to the retention module: only service.ts imports this.
import { prisma, type RetentionConfig } from "@aboutselphy/db";
import type { RetentionSettings } from "@aboutselphy/shared/retention";

export const readConfig = (): Promise<RetentionConfig> => prisma.retentionConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const updateConfig = (data: RetentionSettings): Promise<RetentionConfig> => prisma.retentionConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
