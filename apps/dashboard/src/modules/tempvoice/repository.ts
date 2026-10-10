import "server-only";
// Private to the tempvoice module: only service.ts imports this.
import { prisma, type TempVoiceConfig } from "@aboutselphy/db";

export function readConfig(): Promise<TempVoiceConfig> {
  return prisma.tempVoiceConfig.findUniqueOrThrow({ where: { id: 1 } });
}

export function updateConfig(data: {
  enabled: boolean;
  lobbyChannelId: string | null;
  categoryId: string | null;
  nameTemplate: string;
  defaultUserLimit: number;
  allowVideoByDefault: boolean;
  allowSoundboardByDefault: boolean;
  blockedWords: string[];
}): Promise<TempVoiceConfig> {
  return prisma.tempVoiceConfig.update({ where: { id: 1 }, data });
}
