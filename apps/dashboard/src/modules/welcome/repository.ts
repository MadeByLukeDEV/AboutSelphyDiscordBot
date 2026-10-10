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
  welcomeTemplates: string[];
  welcomeCardEnabled: boolean;
  welcomeCardMode: string;
  welcomeCardTitle: string;
  welcomeCardSubtitle: string;
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

export type CardImageData = { data: Uint8Array<ArrayBuffer>; contentType: string; width: number; height: number; uploadedByName: string };

export function readCardImage() {
  return prisma.welcomeCardImage.findUnique({ where: { id: 1 } });
}

export function saveCardImage(data: CardImageData) {
  const row = { ...data, uploadedByName: data.uploadedByName.slice(0, 100), uploadedAt: new Date() };
  return prisma.welcomeCardImage.upsert({ where: { id: 1 }, update: row, create: { id: 1, ...row } });
}

export async function deleteCardImage(): Promise<void> {
  await prisma.welcomeCardImage.deleteMany({ where: { id: 1 } });
}
