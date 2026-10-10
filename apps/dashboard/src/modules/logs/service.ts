import "server-only";
import { DEFAULT_LOG_SETTINGS, LOG_CATEGORIES, type LogSettings } from "@aboutselphy/shared/logs";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { listRoutes, saveRoutes } from "./repository";
import type { SaveLogsResult } from "./schema";

async function readSettings(): Promise<LogSettings> {
  const rows = await listRoutes();
  const settings: LogSettings = structuredClone(DEFAULT_LOG_SETTINGS);
  for (const row of rows) {
    const category = LOG_CATEGORIES.find((c) => c === row.category);
    if (category) settings[category] = { enabled: row.enabled, channelId: row.channelId ?? "" };
  }
  return settings;
}

/** The settings plus the text channels to pick from (null = the bot can't be reached). */
export async function getLogsPage() {
  const [settings, channels] = await Promise.all([readSettings(), listChannels(["text"])]);
  return { settings, channels };
}

/**
 * Saves where each kind of log goes. A channel that is new must be a text channel of the server
 * (checked through the bot; refused if the bot can't answer). A channel that is already saved needs
 * no lookup, so switching a log on or off still works while the bot is down.
 */
export async function saveLogs(input: LogSettings): Promise<SaveLogsResult> {
  try {
    const current = await readSettings();
    const fresh = LOG_CATEGORIES.map((c) => input[c].channelId).filter((id, i) => id && id !== current[LOG_CATEGORIES[i]!].channelId);
    if (fresh.length > 0) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (fresh.some((id) => !channels.some((c) => c.id === id))) return { ok: false, error: "channelNotFound" };
    }
    await saveRoutes(LOG_CATEGORIES.map((category) => ({ category, enabled: input[category].enabled, channelId: input[category].channelId || null })));
    return { ok: true, settings: await readSettings(), botNotified: await reloadBotModule("logs") };
  } catch (error) {
    console.error("[logs] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
