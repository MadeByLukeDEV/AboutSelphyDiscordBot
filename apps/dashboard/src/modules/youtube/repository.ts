import "server-only";
// Private to the youtube module: only service.ts imports this.
import { prisma, type YoutubeConfig, type YoutubeVideo } from "@aboutselphy/db";

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
