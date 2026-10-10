import "server-only";
import type { ModCase } from "@aboutselphy/db";
import { errorInfo } from "@/lib/log";
import { listChannels, refreshCaseLog, reloadBotModule } from "@/modules/bot-api";
import type { StaffSession } from "@/modules/auth";
import {
  caseStats,
  findCase,
  listCases,
  listCasesForTarget,
  pardonWarning,
  readConfig,
  recentCases,
  updateConfig,
} from "./repository";
import { PAGE_SIZE, type CaseQuery, type PardonResult, type SaveSettingsResult, type SettingsInput } from "./schema";

export async function getCasesPage(query: CaseQuery) {
  const { rows, total } = await listCases(query);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getCaseDetail(caseNumber: number): Promise<{ row: ModCase; others: ModCase[] } | null> {
  const row = await findCase(caseNumber);
  if (!row) return null;
  return { row, others: await listCasesForTarget(row.targetId, row.caseNumber, 10) };
}

const DAY_MS = 86_400_000;

/** What the overview shows: the last 7 days by type, active warnings, the latest cases. */
export async function getOverview() {
  const [stats, recent] = await Promise.all([caseStats(new Date(Date.now() - 7 * DAY_MS)), recentCases(5)]);
  return { ...stats, recent };
}

/** Current settings plus the channels to pick from (null channels = the bot is unreachable). */
export async function getSettings() {
  const [config, channels] = await Promise.all([readConfig(), listChannels(["text"])]);
  return { logChannelId: config.logChannelId ?? "", dmOnAction: config.dmOnAction, channels };
}

export async function saveSettings(input: SettingsInput): Promise<SaveSettingsResult> {
  try {
    const current = await readConfig();
    const wanted = input.logChannelId || null;

    // A channel ID typed into a crafted request must not be stored blindly: it
    // has to be a text channel the bot can see. If the bot can't answer, a
    // channel change is refused rather than trusted.
    if (wanted && wanted !== current.logChannelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === wanted)) return { ok: false, error: "channelNotFound" };
    }

    const saved = await updateConfig({ logChannelId: wanted, dmOnAction: input.dmOnAction });
    // The bot caches this config (60 s TTL); tell it to drop the cache now.
    const botNotified = await reloadBotModule("moderation");
    return { ok: true, logChannelId: saved.logChannelId ?? "", dmOnAction: saved.dmOnAction, botNotified };
  } catch (error) {
    console.error("[moderation] saving settings failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function pardon(caseNumber: number, by: StaffSession["user"]): Promise<PardonResult> {
  try {
    const changed = await pardonWarning(caseNumber, { userId: by.id, name: by.name });
    if (changed === 0) {
      return { ok: false, error: (await findCase(caseNumber)) ? "notActiveWarning" : "notFound" };
    }
    console.info(`[moderation] case #${caseNumber} pardoned by auth user ${by.id}`);
    // Refresh the Discord embed so it shows "(pardoned)". Best effort: the
    // pardon itself is already saved.
    const logStatus = await refreshCaseLog(caseNumber);
    return { ok: true, logUpdated: logStatus === "updated" };
  } catch (error) {
    console.error("[moderation] pardon failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
