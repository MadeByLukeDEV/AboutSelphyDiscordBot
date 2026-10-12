import "server-only";
import type { AntiBotConfig } from "@aboutselphy/db";
import type { AntiBotSettings } from "@aboutselphy/shared/antibot";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { readConfig, updateConfig } from "./repository";
import type { AntiBotStats, SaveAntiBotResult } from "./schema";

const toSettings = (c: AntiBotConfig): AntiBotSettings => ({ enabled: c.enabled, channelId: c.channelId ?? "", timeoutSeconds: c.timeoutSeconds, dryRun: c.dryRun });

/** Settings, the catch counter, and the channels to pick from (null = bot unreachable). */
export async function getAntiBotPage() {
  const [config, channels] = await Promise.all([readConfig(), listChannels(["text"])]);
  const stats: AntiBotStats = { hits: config.hits, lastHitAt: config.lastHitAt?.toISOString() ?? null };
  return { settings: toSettings(config), stats, channels };
}

/** Saves the settings. A new channel must be a text channel of the server (checked through the bot; refused if it can't answer). */
export async function saveAntiBot(input: AntiBotSettings): Promise<SaveAntiBotResult> {
  try {
    const current = await readConfig();
    if (input.channelId && input.channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    const saved = await updateConfig({ ...input, channelId: input.channelId || null });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("antibot") };
  } catch (error) {
    console.error("[antibot] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
