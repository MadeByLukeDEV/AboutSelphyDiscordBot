// Private to the youtube module: only service.ts and config.ts import this.
import { prisma, type YoutubeChannel, type YoutubeConfig, type YoutubeVideo } from "@aboutselphy/db";

export function readConfig(): Promise<YoutubeConfig> {
  return prisma.youtubeConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** What the poller reports after a round: when it last got an answer, and a short code if it failed. */
export function recordPoll(lastCheckedAt: Date | null, lastError: string): Promise<unknown> {
  return prisma.youtubeConfig.upsert({
    where: { id: 1 },
    update: { ...(lastCheckedAt ? { lastCheckedAt } : {}), lastError },
    create: { id: 1, lastCheckedAt, lastError },
  });
}

export async function knownVideoIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.youtubeVideo.findMany({ where: { videoId: { in: ids } }, select: { videoId: true } });
  return new Set(rows.map((r) => r.videoId));
}

export function hasAnyVideo(): Promise<boolean> {
  return prisma.youtubeVideo.count().then((n) => n > 0);
}

/**
 * Copies the channel from YOUTUBE_CHANNEL_ID into the table once, so the dashboard's list is the only list afterwards (removing it there is
 * permanent). Videos already remembered mean it was polled before: it counts as seeded, so nothing old is announced.
 */
export async function adoptEnvChannel(config: YoutubeConfig, ytChannelId: string | undefined): Promise<void> {
  if (config.envAdopted) return;
  if (ytChannelId) {
    const seeded = await hasAnyVideo();
    await prisma.youtubeChannel.upsert({ where: { ytChannelId }, update: {}, create: { ytChannelId, seededAt: seeded ? new Date() : null } });
  }
  await prisma.youtubeConfig.update({ where: { id: 1 }, data: { envAdopted: true } });
}

export function enabledChannels(): Promise<YoutubeChannel[]> {
  return prisma.youtubeChannel.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
}

/** After a successful look: the channel is seeded (later polls may announce) and gets its name from YouTube when it had none. */
export function markChannelPolled(id: string, name: string | null, hadName: boolean): Promise<unknown> {
  return prisma.youtubeChannel.update({ where: { id }, data: { seededAt: new Date(), ...(!hadName && name ? { name: name.slice(0, 100) } : {}) } });
}

export type NewVideo = {
  videoId: string;
  title: string;
  publishedAt: Date;
  isShort: boolean;
  messageId: string | null;
  announcedAt: Date | null;
};

/** Idempotent: a video that is already there is left alone (two rounds can overlap). */
export async function rememberVideo(data: NewVideo): Promise<YoutubeVideo | null> {
  try {
    return await prisma.youtubeVideo.create({ data: { ...data, title: data.title.slice(0, 300) } });
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === "P2002") return null;
    throw err;
  }
}
