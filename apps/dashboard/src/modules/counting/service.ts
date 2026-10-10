import "server-only";
import type { CountingConfig } from "@aboutselphy/db";
import type { CountingSettings } from "@aboutselphy/shared/counting";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { readConfig, resetCount, updateConfig } from "./repository";
import type { CountingStats, ResetCountingResult, SaveCountingResult } from "./schema";

const toSettings = (c: CountingConfig): CountingSettings => ({ enabled: c.enabled, channelId: c.channelId ?? "", allowConsecutive: c.allowConsecutive, resetOnMistake: c.resetOnMistake });

export async function getCountingPage() {
  const [config, channels] = await Promise.all([readConfig(), listChannels(["text"])]);
  const stats: CountingStats = { currentCount: config.currentCount, highScore: config.highScore, lastUserId: config.lastUserId };
  return { settings: toSettings(config), stats, channels };
}

/** Saves the settings. A new channel must be a text channel of the server (checked through the bot; refused if it can't answer). */
export async function saveCounting(input: CountingSettings): Promise<SaveCountingResult> {
  try {
    const current = await readConfig();
    if (input.channelId && input.channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    const saved = await updateConfig({ enabled: input.enabled, channelId: input.channelId || null, allowConsecutive: input.allowConsecutive, resetOnMistake: input.resetOnMistake });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("counting") };
  } catch (error) {
    console.error("[counting] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function resetCounting(): Promise<ResetCountingResult> {
  try {
    await resetCount();
    return { ok: true };
  } catch (error) {
    console.error("[counting] reset failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
