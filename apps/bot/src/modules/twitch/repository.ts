// Private to the twitch module: only service.ts, tokens.ts and commands.ts import this.
import { prisma, type TwitchConfig, type TwitchConnection, type TwitchNotification, type TwitchStreamer } from "@aboutselphy/db";

// -- settings (singleton rows, created on first use) -------------------------------

export function readConfig(): Promise<TwitchConfig> {
  return prisma.twitchConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function updateConfig(data: Partial<Pick<TwitchConfig, "enabled" | "markEndedOnOffline">>): Promise<TwitchConfig> {
  return prisma.twitchConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

// -- the connected Twitch account ------------------------------------------------------

export function readConnection(): Promise<TwitchConnection | null> {
  return prisma.twitchConnection.findUnique({ where: { id: 1 } });
}

/** Twitch rotates refresh tokens: whatever it hands back replaces the old one. */
export function storeRefreshToken(refreshTokenEnc: string): Promise<unknown> {
  return prisma.twitchConnection.updateMany({ where: { id: 1 }, data: { refreshTokenEnc, needsReconnect: false } });
}

export function markNeedsReconnect(): Promise<unknown> {
  return prisma.twitchConnection.updateMany({ where: { id: 1 }, data: { needsReconnect: true } });
}

// -- streamers --------------------------------------------------------------------------

export type StreamerFields = Pick<TwitchStreamer, "channelId" | "pingRoleId" | "messageTemplate" | "enabled">;

export function listStreamers(): Promise<TwitchStreamer[]> {
  return prisma.twitchStreamer.findMany({ orderBy: { createdAt: "asc" } });
}

export function upsertStreamer(
  who: { twitchUserId: string; login: string; displayName: string },
  fields: Partial<StreamerFields> & { channelId: string },
): Promise<TwitchStreamer> {
  return prisma.twitchStreamer.upsert({
    where: { twitchUserId: who.twitchUserId },
    update: { login: who.login, displayName: who.displayName, ...fields },
    create: { ...who, ...fields },
  });
}

export function updateStreamerNames(twitchUserId: string, login: string, displayName: string): Promise<unknown> {
  return prisma.twitchStreamer.updateMany({ where: { twitchUserId }, data: { login, displayName } });
}

/** Idempotent. Past announcements stay where they are. */
export async function deleteStreamerByLogin(login: string): Promise<boolean> {
  const { count } = await prisma.twitchStreamer.deleteMany({ where: { login: login.toLowerCase() } });
  return count > 0;
}

// -- announcements ------------------------------------------------------------------------

export type NotificationInput = {
  twitchStreamId: string;
  twitchUserId: string;
  login: string;
  displayName: string;
  title: string;
  game: string;
  channelId: string;
  messageId: string | null;
  startedAt: Date;
};

export function findNotification(twitchStreamId: string): Promise<TwitchNotification | null> {
  return prisma.twitchNotification.findUnique({ where: { twitchStreamId } });
}

export function createNotification(data: NotificationInput): Promise<TwitchNotification> {
  return prisma.twitchNotification.create({ data });
}

/** Broadcasts we announced (or baselined) that have not been marked ended. */
export function listOpenNotifications(): Promise<TwitchNotification[]> {
  return prisma.twitchNotification.findMany({ where: { endedAt: null }, orderBy: { startedAt: "asc" } });
}

export function openNotificationsFor(twitchUserId: string): Promise<TwitchNotification[]> {
  return prisma.twitchNotification.findMany({ where: { twitchUserId, endedAt: null }, orderBy: { startedAt: "desc" } });
}

/** Returns false if it was already ended (another path got there first). */
export async function markNotificationEnded(id: string, endedAt: Date): Promise<boolean> {
  const { count } = await prisma.twitchNotification.updateMany({ where: { id, endedAt: null }, data: { endedAt } });
  return count > 0;
}

export function hasAnyNotification(twitchUserId: string): Promise<boolean> {
  return prisma.twitchNotification.count({ where: { twitchUserId } }).then((n) => n > 0);
}
