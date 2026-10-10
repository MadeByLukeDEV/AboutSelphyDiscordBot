import "server-only";
// Private to the welcome module: only service.ts imports this.
import { prisma, type WelcomeConfig } from "@aboutselphy/db";

export function readConfig(): Promise<WelcomeConfig> {
  return prisma.welcomeConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export type ConfigData = {
  autoRoleIds: string[];
  botAutoRoleIds: string[];
  restoreRoles: boolean;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeTemplate: string;
  welcomeAsEmbed: boolean;
  welcomeColor: number;
  welcomeImageUrl: string;
  dmEnabled: boolean;
  dmTemplate: string;
  goodbyeEnabled: boolean;
  goodbyeChannelId: string | null;
  goodbyeTemplate: string;
};

export function updateConfig(data: ConfigData): Promise<WelcomeConfig> {
  return prisma.welcomeConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}
