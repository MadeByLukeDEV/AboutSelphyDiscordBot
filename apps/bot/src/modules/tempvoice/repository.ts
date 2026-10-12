// Private to the tempvoice module: only service.ts, config.ts and commands.ts import this.
import { prisma, type TempVoiceChannel, type TempVoiceConfig, type TempVoiceLobby } from "@aboutselphy/db";

export type ConfigUpdate = Partial<Pick<TempVoiceConfig, "enabled" | "blockedWords" | "useDefaultBlocklist">>;

export type LobbyFields = Pick<
  TempVoiceLobby,
  "categoryId" | "nameTemplate" | "defaultUserLimit" | "allowVideoByDefault" | "allowSoundboardByDefault" | "enabled"
>;

// -- settings shared by every lobby ------------------------------------------------

export function readConfig(): Promise<TempVoiceConfig> {
  return prisma.tempVoiceConfig.findUniqueOrThrow({ where: { id: 1 } });
}

export function updateConfig(data: ConfigUpdate): Promise<TempVoiceConfig> {
  return prisma.tempVoiceConfig.update({ where: { id: 1 }, data });
}

// -- lobbies --------------------------------------------------------------------------

export function listLobbies(): Promise<TempVoiceLobby[]> {
  return prisma.tempVoiceLobby.findMany({ orderBy: { createdAt: "asc" } });
}

export function createLobby(channelId: string, fields: Partial<LobbyFields> = {}): Promise<TempVoiceLobby> {
  return prisma.tempVoiceLobby.create({ data: { channelId, ...fields } });
}

export function updateLobby(channelId: string, fields: Partial<LobbyFields>): Promise<TempVoiceLobby> {
  return prisma.tempVoiceLobby.update({ where: { channelId }, data: fields });
}

/** Idempotent. Open rooms made from this lobby are left alone. */
export async function deleteLobby(channelId: string): Promise<boolean> {
  const { count } = await prisma.tempVoiceLobby.deleteMany({ where: { channelId } });
  return count > 0;
}

// -- rooms -------------------------------------------------------------------------------

export function listRooms(): Promise<TempVoiceChannel[]> {
  return prisma.tempVoiceChannel.findMany({ orderBy: { createdAt: "asc" } });
}

export function findRoom(channelId: string): Promise<TempVoiceChannel | null> {
  return prisma.tempVoiceChannel.findUnique({ where: { channelId } });
}

export function findRoomsByOwner(ownerId: string): Promise<TempVoiceChannel[]> {
  return prisma.tempVoiceChannel.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } });
}

export function insertRoom(channelId: string, ownerId: string, lobbyChannelId: string): Promise<TempVoiceChannel> {
  return prisma.tempVoiceChannel.create({ data: { channelId, ownerId, lobbyChannelId } });
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

// -- remembered rooms ---------------------------------------------------------------------

export const findPreference = (userId: string) => prisma.tempVoicePreference.findUnique({ where: { userId } });

export const savePreference = (userId: string, data: { name: string; userLimit: number; locked: boolean; videoAllowed: boolean; soundboardAllowed: boolean }) =>
  prisma.tempVoicePreference.upsert({ where: { userId }, update: data, create: { userId, ...data } });
