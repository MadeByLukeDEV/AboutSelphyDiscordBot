import "server-only";
import type { ReminderConfig } from "@aboutselphy/db";
import type { ReminderSettings } from "@aboutselphy/shared/reminders";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { getCardImageView } from "@/modules/member-cards";
import { readConfig, stats, updateConfig } from "./repository";
import type { ReminderStats, SaveReminderResult } from "./schema";

const toSettings = (c: ReminderConfig): ReminderSettings => ({ enabled: c.enabled, maxPerUser: c.maxPerUser, channelId: c.channelId ?? "", cardEnabled: c.cardEnabled, cardMode: c.cardMode === "sticker" ? "sticker" : "background", cardTitle: c.cardTitle });

export async function getRemindersPage() {
  const [config, s, cardImage, channels] = await Promise.all([readConfig(), stats(), getCardImageView("reminder"), listChannels(["text"])]);
  const summary: ReminderStats = { pending: s.pending, nextAt: s.nextAt?.toISOString() ?? null };
  return { settings: toSettings(config), stats: summary, cardImage, channels };
}

export async function saveReminders(input: ReminderSettings): Promise<SaveReminderResult> {
  try {
    const current = await readConfig();
    if (input.channelId && input.channelId !== current.channelId) {
      // A new channel must be a text channel of the server (checked through the bot; refused if it can't answer).
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    const saved = await updateConfig({ ...input, channelId: input.channelId || null });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("reminders") };
  } catch (error) {
    console.error("[reminders] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
