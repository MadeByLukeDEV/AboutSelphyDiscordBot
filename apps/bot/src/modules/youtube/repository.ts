// Private to the youtube module: only service.ts and config.ts import this.
import { prisma, type YoutubeConfig, type YoutubeVideo } from "@aboutselphy/db";

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
