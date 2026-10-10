import "server-only";
import type { StarboardConfig } from "@aboutselphy/db";
import { normalizeEmoji, type StarboardSettings } from "@aboutselphy/shared/starboard";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { readConfig, topPosts, updateConfig } from "./repository";
import type { SaveStarboardResult, StarboardRow } from "./schema";

const toSettings = (c: StarboardConfig): StarboardSettings => ({ enabled: c.enabled, channelId: c.channelId ?? "", emoji: c.emoji, threshold: c.threshold, allowSelf: c.allowSelf });

/** Settings, the most starred messages, and the channels to pick from (null = bot unreachable). */
export async function getStarboardPage() {
  const [config, rows, channels] = await Promise.all([readConfig(), topPosts(25), listChannels(["text"])]);
  const posts: StarboardRow[] = rows.map((p) => ({
    messageId: p.sourceMessageId,
    channelId: p.sourceChannelId,
    authorName: p.authorName,
    excerpt: p.excerpt,
    jumpUrl: p.jumpUrl,
    stars: p.stars,
    onBoard: p.boardMessageId !== null,
    createdAt: p.createdAt.toISOString(),
  }));
  return { settings: toSettings(config), posts, channels };
}

/** Saves the settings. A new channel must be a text channel of the server (checked through the bot; refused if it can't answer). */
export async function saveStarboard(input: StarboardSettings): Promise<SaveStarboardResult> {
  try {
    const current = await readConfig();
    if (input.channelId && input.channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    const saved = await updateConfig({ enabled: input.enabled, channelId: input.channelId || null, emoji: normalizeEmoji(input.emoji), threshold: input.threshold, allowSelf: input.allowSelf });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("starboard") };
  } catch (error) {
    console.error("[starboard] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
