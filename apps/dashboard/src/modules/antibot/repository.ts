import "server-only";
// Private to the antibot module: only service.ts imports this.
import { prisma, type AntiBotConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<AntiBotConfig> => prisma.antiBotConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateConfig(data: { enabled: boolean; channelId: string | null; timeoutSeconds: number; dryRun: boolean }): Promise<AntiBotConfig> {
  return prisma.antiBotConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}
