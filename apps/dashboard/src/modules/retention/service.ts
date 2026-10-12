import "server-only";
import type { RetentionConfig } from "@aboutselphy/db";
import type { RetentionSettings } from "@aboutselphy/shared/retention";
import { errorInfo } from "@/lib/log";
import { reloadBotModule } from "@/modules/bot-api";
import { readConfig, updateConfig } from "./repository";
import type { RetentionLastRun, SaveRetentionResult } from "./schema";

const toSettings = (c: RetentionConfig): RetentionSettings => ({ ticketTranscriptDays: c.ticketTranscriptDays, caseDays: c.caseDays, suggestionDays: c.suggestionDays, inactiveXpDays: c.inactiveXpDays });

export async function getRetentionPage() {
  const config = await readConfig();
  const last: RetentionLastRun = { at: config.lastRunAt?.toISOString() ?? null, result: config.lastResult };
  return { settings: toSettings(config), last };
}

/** Saves the limits and asks the bot to run the clean-up now (it also runs once a day). */
export async function saveRetention(input: RetentionSettings): Promise<SaveRetentionResult> {
  try {
    const saved = await updateConfig(input);
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("retention") };
  } catch (error) {
    console.error("[retention] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
