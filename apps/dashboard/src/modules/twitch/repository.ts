import "server-only";
// Private to the twitch module: only service.ts imports this.
import { prisma, type TwitchConfig, type TwitchConnection, type TwitchStreamer } from "@aboutselphy/db";

export function readConfig(): Promise<TwitchConfig> {
  return prisma.twitchConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function updateConfig(data: { enabled: boolean; markEndedOnOffline: boolean }): Promise<TwitchConfig> {
  return prisma.twitchConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

export function readConnection(): Promise<TwitchConnection | null> {
  return prisma.twitchConnection.findUnique({ where: { id: 1 } });
}

export function saveConnection(data: { twitchUserId: string; login: string; refreshTokenEnc: string; connectedByName: string }) {
  const row = { ...data, needsReconnect: false };
  return prisma.twitchConnection.upsert({ where: { id: 1 }, create: { id: 1, ...row }, update: row });
}

export async function deleteConnection(): Promise<void> {
  await prisma.twitchConnection.deleteMany({ where: { id: 1 } });
}

export function listStreamers(): Promise<TwitchStreamer[]> {
  return prisma.twitchStreamer.findMany({ orderBy: { createdAt: "asc" } });
}

export async function deleteStreamer(id: string): Promise<number> {
  return (await prisma.twitchStreamer.deleteMany({ where: { id } })).count;
}

export async function setStreamerEnabled(id: string, enabled: boolean): Promise<number> {
  return (await prisma.twitchStreamer.updateMany({ where: { id }, data: { enabled } })).count;
}
