import "server-only";
import type { YoutubeConfig } from "@aboutselphy/db";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { readConfig, recentVideos, updateConfig } from "./repository";
import type { SaveYoutubeResult, YoutubeOverview, YoutubeSettings } from "./schema";

const toSettings = (c: YoutubeConfig): YoutubeSettings => ({
  enabled: c.enabled,
  channelId: c.channelId ?? "",
  pingRoleId: c.pingRoleId ?? "",
  messageTemplate: c.messageTemplate,
  announceShorts: c.announceShorts,
  showWatchButton: c.showWatchButton,
  announcePremieres: c.announcePremieres,
  premiereTemplate: c.premiereTemplate,
  embedColor: c.embedColor,
});

/** The settings, the poller's last result, the latest videos, and the lists to pick from (null = bot unreachable). */
export async function getYoutubePage() {
  const [config, videos, channels, roles] = await Promise.all([readConfig(), recentVideos(), listChannels(["text"]), listRoles()]);
  const overview: YoutubeOverview = {
    settings: toSettings(config),
    lastCheckedAt: config.lastCheckedAt?.toISOString() ?? null,
    lastError: config.lastError,
    videos: videos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt.toISOString(),
      isShort: v.isShort,
      announced: v.announcedAt !== null,
    })),
  };
  return { overview, channels, roles };
}

/**
 * Saves the settings. The channel and role must exist in the server (checked through the
 * bot); when the bot can't answer, a change that needs the check is refused.
 */
export async function saveYoutube(input: YoutubeSettings): Promise<SaveYoutubeResult> {
  try {
    const current = await readConfig();
    const channelId = input.channelId || null;
    const roleId = input.pingRoleId || null;

    if (channelId && channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === channelId)) return { ok: false, error: "channelNotFound" };
    }
    if (roleId && roleId !== current.pingRoleId) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      if (!roles.some((r) => r.id === roleId)) return { ok: false, error: "roleNotFound" };
    }

    const saved = await updateConfig({
      enabled: input.enabled,
      channelId,
      pingRoleId: roleId,
      messageTemplate: input.messageTemplate,
      announceShorts: input.announceShorts,
      showWatchButton: input.showWatchButton,
      announcePremieres: input.announcePremieres,
      premiereTemplate: input.premiereTemplate,
      embedColor: input.embedColor,
    });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("youtube") };
  } catch (error) {
    console.error("[youtube] saving the settings failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
