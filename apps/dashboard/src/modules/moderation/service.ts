import "server-only";
import type { ModCase, ModConfig } from "@aboutselphy/db";
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
import { formatDuration, parseDuration } from "@aboutselphy/shared/duration";
import { DEFAULT_ESCALATION, PAGE_SIZE, type CaseQuery, type PardonResult, type SaveSettingsResult, type SettingsInput } from "./schema";

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

const toSettings = (c: ModConfig): SettingsInput => ({
  logChannelId: c.logChannelId ?? "",
  dmOnAction: c.dmOnAction,
  escalationEnabled: c.escalationThreshold !== null && c.escalationAction !== null,
  escalationThreshold: c.escalationThreshold ?? DEFAULT_ESCALATION.escalationThreshold,
  escalationAction: c.escalationAction ?? DEFAULT_ESCALATION.escalationAction,
  escalationWindow: c.escalationWindowDays ? String(c.escalationWindowDays) : "",
  escalationDuration: c.escalationDurationSeconds ? formatDuration(c.escalationDurationSeconds).replaceAll(" ", "") : c.escalationAction ? "" : DEFAULT_ESCALATION.escalationDuration,
});

/** Current settings plus the channels to pick from (null channels = the bot is unreachable). */
export async function getSettings() {
  const [config, channels] = await Promise.all([readConfig(), listChannels(["text"])]);
  return { settings: toSettings(config), channels };
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

    // Off = all three columns empty (the database insists on it). A kick has no length.
    const seconds = input.escalationEnabled && input.escalationAction !== "kick" && input.escalationDuration ? parseDuration(input.escalationDuration) : null;
    const saved = await updateConfig({
      logChannelId: wanted,
      dmOnAction: input.dmOnAction,
      escalationThreshold: input.escalationEnabled ? input.escalationThreshold : null,
      escalationAction: input.escalationEnabled ? input.escalationAction : null,
      escalationDurationSeconds: input.escalationEnabled ? seconds : null,
      escalationWindowDays: input.escalationEnabled && input.escalationWindow ? Number(input.escalationWindow) : null,
    });
    // The bot caches this config (60 s TTL); tell it to drop the cache now.
    const botNotified = await reloadBotModule("moderation");
    return { ok: true, settings: toSettings(saved), botNotified };
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
