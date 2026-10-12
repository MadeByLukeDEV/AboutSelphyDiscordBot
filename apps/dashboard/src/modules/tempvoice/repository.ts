import "server-only";
// Private to the tempvoice module: only service.ts imports this.
import { prisma, type TempVoiceConfig, type TempVoiceLobby } from "@aboutselphy/db";

export function readConfig(): Promise<TempVoiceConfig> {
  return prisma.tempVoiceConfig.findUniqueOrThrow({ where: { id: 1 } });
}

export function updateConfig(data: { enabled: boolean; blockedWords: string[]; useDefaultBlocklist: boolean; rememberSettings: boolean }): Promise<TempVoiceConfig> {
  return prisma.tempVoiceConfig.update({ where: { id: 1 }, data });
}

export type LobbyData = {
  categoryId: string | null;
  nameTemplate: string;
  defaultUserLimit: number;
  allowVideoByDefault: boolean;
  allowSoundboardByDefault: boolean;
  enabled: boolean;
};

export function listLobbies(): Promise<TempVoiceLobby[]> {
  return prisma.tempVoiceLobby.findMany({ orderBy: { createdAt: "asc" } });
}

export function countLobbies(): Promise<number> {
  return prisma.tempVoiceLobby.count();
}

export function findLobby(id: string): Promise<TempVoiceLobby | null> {
  return prisma.tempVoiceLobby.findUnique({ where: { id } });
}

export function findLobbyByChannel(channelId: string): Promise<TempVoiceLobby | null> {
  return prisma.tempVoiceLobby.findUnique({ where: { channelId } });
}

/** A channel the bot made as a room can't also be a lobby. */
export async function isRoomChannel(channelId: string): Promise<boolean> {
  return (await prisma.tempVoiceChannel.findUnique({ where: { channelId }, select: { id: true } })) !== null;
}

export function createLobby(channelId: string, data: LobbyData): Promise<TempVoiceLobby> {
  return prisma.tempVoiceLobby.create({ data: { channelId, ...data } });
}

export function updateLobby(id: string, data: LobbyData): Promise<TempVoiceLobby> {
  return prisma.tempVoiceLobby.update({ where: { id }, data });
}

/** Returns how many rows were removed (0 or 1): deleting twice is not an error. */
export async function deleteLobby(id: string): Promise<number> {
  const { count } = await prisma.tempVoiceLobby.deleteMany({ where: { id } });
  return count;
}
