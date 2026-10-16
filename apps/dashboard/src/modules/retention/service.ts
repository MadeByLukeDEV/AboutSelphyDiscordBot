import "server-only";
import type { RetentionConfig } from "@aboutselphy/db";
import type { RetentionSettings } from "@aboutselphy/shared/retention";
import { errorInfo } from "@/lib/log";
import { eraseMemberViaBot, reloadBotModule } from "@/modules/bot-api";
import { readConfig, updateConfig } from "./repository";
import type { EraseMemberResult, RetentionLastRun, SaveRetentionResult } from "./schema";

const toSettings = (c: RetentionConfig): RetentionSettings => ({ ticketTranscriptDays: c.ticketTranscriptDays, caseDays: c.caseDays, suggestionDays: c.suggestionDays, inactiveXpDays: c.inactiveXpDays, pollDays: c.pollDays, giveawayDays: c.giveawayDays, starboardDays: c.starboardDays });

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

/** Erases one member's data on request through the bot. Returns a short summary of what was removed (counts only, no personal data). */
export async function eraseMember(userId: string): Promise<EraseMemberResult> {
  try {
    const done = await eraseMemberViaBot(userId);
    if (!done) return { ok: false, error: "botUnavailable" };
    const c = done.counts;
    const parts = [
      [c.birthday, "birthday"], [c.reminders, "reminders"], [c.levels, "level record"], [c.rememberedRoles, "remembered roles"], [c.voiceRoom, "voice room"], [c.invites, "invite record"], [c.votes, "votes"], [c.entries, "giveaway entries"], [c.suggestionsAnonymised, "suggestions anonymised"], [c.starboardAnonymised, "starboard posts anonymised"],
    ].filter(([n]) => (n as number) > 0).map(([n, label]) => `${n} ${label}`);
    if (done.twitchLinkRemoved) parts.push("Twitch link");
    return { ok: true, summary: parts.join(", "), empty: parts.length === 0 };
  } catch (error) {
    console.error("[retention] erasing a member failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
