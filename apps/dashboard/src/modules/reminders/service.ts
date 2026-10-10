import "server-only";
import type { ReminderConfig } from "@aboutselphy/db";
import type { ReminderSettings } from "@aboutselphy/shared/reminders";
import { errorInfo } from "@/lib/log";
import { reloadBotModule } from "@/modules/bot-api";
import { readConfig, stats, updateConfig } from "./repository";
import type { ReminderStats, SaveReminderResult } from "./schema";

const toSettings = (c: ReminderConfig): ReminderSettings => ({ enabled: c.enabled, maxPerUser: c.maxPerUser });

export async function getRemindersPage() {
  const [config, s] = await Promise.all([readConfig(), stats()]);
  const summary: ReminderStats = { pending: s.pending, nextAt: s.nextAt?.toISOString() ?? null };
  return { settings: toSettings(config), stats: summary };
}

export async function saveReminders(input: ReminderSettings): Promise<SaveReminderResult> {
  try {
    const saved = await updateConfig(input);
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("reminders") };
  } catch (error) {
    console.error("[reminders] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
