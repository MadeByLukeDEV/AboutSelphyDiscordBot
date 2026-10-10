// Private to the tempvoice module: only service.ts and config.ts import this.
import { prisma, type TempVoiceChannel, type TempVoiceConfig } from "@aboutselphy/db";

export type ConfigUpdate = Partial<
  Pick<
    TempVoiceConfig,
    | "enabled"
    | "lobbyChannelId"
    | "categoryId"
    | "nameTemplate"
    | "defaultUserLimit"
    | "allowVideoByDefault"
    | "allowSoundboardByDefault"
    | "blockedWords"
  >
>;

export function readConfig(): Promise<TempVoiceConfig> {
  return prisma.tempVoiceConfig.findUniqueOrThrow({ where: { id: 1 } });
}

export function updateConfig(data: ConfigUpdate): Promise<TempVoiceConfig> {
  return prisma.tempVoiceConfig.update({ where: { id: 1 }, data });
}

export function listRooms(): Promise<TempVoiceChannel[]> {
  return prisma.tempVoiceChannel.findMany({ orderBy: { createdAt: "asc" } });
}

export function findRoom(channelId: string): Promise<TempVoiceChannel | null> {
  return prisma.tempVoiceChannel.findUnique({ where: { channelId } });
}

export function findRoomsByOwner(ownerId: string): Promise<TempVoiceChannel[]> {
  return prisma.tempVoiceChannel.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } });
}

export function insertRoom(channelId: string, ownerId: string): Promise<TempVoiceChannel> {
  return prisma.tempVoiceChannel.create({ data: { channelId, ownerId } });
}

/** Idempotent: deleting a row that is already gone is not an error. */
export async function deleteRoom(channelId: string): Promise<void> {
  await prisma.tempVoiceChannel.deleteMany({ where: { channelId } });
}

export function setOwner(channelId: string, ownerId: string) {
  return prisma.tempVoiceChannel.update({ where: { channelId }, data: { ownerId } });
}

export function setPanelMessage(channelId: string, panelMessageId: string | null) {
  return prisma.tempVoiceChannel.update({ where: { channelId }, data: { panelMessageId } });
}
