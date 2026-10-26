import "server-only";
// Private to the youtube module: only service.ts imports this.
import { prisma, type YoutubeChannel, type YoutubeConfig, type YoutubeVideo } from "@aboutselphy/db";

export function readConfig(): Promise<YoutubeConfig> {
  return prisma.youtubeConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function updateConfig(data: {
  enabled: boolean;
  channelId: string | null;
  pingRoleId: string | null;
  messageTemplate: string;
  announceShorts: boolean;
  showWatchButton: boolean;
  announcePremieres: boolean;
  premiereTemplate: string;
  embedColor: number;
}): Promise<YoutubeConfig> {
  return prisma.youtubeConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

export function recentVideos(take = 10): Promise<YoutubeVideo[]> {
  return prisma.youtubeVideo.findMany({ orderBy: { publishedAt: "desc" }, take });
}

export function listYoutubeChannels(): Promise<YoutubeChannel[]> {
  return prisma.youtubeChannel.findMany({ orderBy: { createdAt: "asc" } });
}

export function countYoutubeChannels(): Promise<number> {
  return prisma.youtubeChannel.count();
}

export function createYoutubeChannel(ytChannelId: string): Promise<YoutubeChannel> {
  return prisma.youtubeChannel.create({ data: { ytChannelId } });
}

export function setYoutubeChannelEnabled(id: string, enabled: boolean): Promise<unknown> {
  return prisma.youtubeChannel.updateMany({ where: { id }, data: { enabled } });
}

export function deleteYoutubeChannel(id: string): Promise<unknown> {
  return prisma.youtubeChannel.deleteMany({ where: { id } });
}
