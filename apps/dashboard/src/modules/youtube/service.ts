import "server-only";
import type { YoutubeConfig } from "@aboutselphy/db";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { countYoutubeChannels, createYoutubeChannel, deleteYoutubeChannel, listYoutubeChannels, readConfig, recentVideos, setYoutubeChannelEnabled, updateConfig } from "./repository";
import { MAX_YOUTUBE_CHANNELS, parseYoutubeChannelId, type SaveYoutubeResult, type YoutubeChannelResult, type YoutubeChannelView, type YoutubeOverview, type YoutubeSettings } from "./schema";

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

const channelViews = async (): Promise<YoutubeChannelView[]> =>
  (await listYoutubeChannels()).map((c) => ({ id: c.id, ytChannelId: c.ytChannelId, name: c.name, enabled: c.enabled }));

/** Adds a watched channel from a typed ID or channel link, switches one on or off, or removes one; then asks the bot to poll. */
export async function changeYoutubeChannels(change: { add: string } | { toggle: string; enabled: boolean } | { remove: string }): Promise<YoutubeChannelResult> {
  try {
    if ("add" in change) {
      const ytChannelId = parseYoutubeChannelId(change.add);
      if (!ytChannelId) return { ok: false, error: "invalidChannel" };
      if ((await countYoutubeChannels()) >= MAX_YOUTUBE_CHANNELS) return { ok: false, error: "tooMany" };
      try {
        await createYoutubeChannel(ytChannelId);
      } catch (error) {
        if ((error as { code?: unknown } | null)?.code === "P2002") return { ok: false, error: "alreadyAdded" };
        throw error;
      }
    } else if ("toggle" in change) {
      await setYoutubeChannelEnabled(change.toggle, change.enabled);
    } else {
      await deleteYoutubeChannel(change.remove);
    }
    return { ok: true, channels: await channelViews(), botNotified: await reloadBotModule("youtube") };
  } catch (error) {
    console.error("[youtube] changing the channels failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** The settings, the poller's last result, the latest videos, and the lists to pick from (null = bot unreachable). */
export async function getYoutubePage() {
  const [config, videos, channels, roles, watched] = await Promise.all([readConfig(), recentVideos(), listChannels(["text"]), listRoles(), channelViews()]);
  const overview: YoutubeOverview = {
    settings: toSettings(config),
    lastCheckedAt: config.lastCheckedAt?.toISOString() ?? null,
    lastError: config.lastError,
    channels: watched,
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
