import "server-only";
import type { ModCase, ModConfig } from "@aboutselphy/db";
import { errorInfo } from "@/lib/log";
import { listChannels, moderationActViaBot, refreshCaseLog, reloadBotModule } from "@/modules/bot-api";
import type { StaffSession } from "@/modules/auth";
import {
  caseStats,
  editReason,
  findCase,
  listCases,
  listCasesForTarget,
  pardonWarning,
  readConfig,
  recentCases,
  updateConfig,
} from "./repository";
import { formatDuration, MAX_TIMEOUT_SECONDS, MIN_TIMEOUT_SECONDS, parseDuration } from "@aboutselphy/shared/duration";
import { MAX_TEMP_BAN_SECONDS, REASON_REQUIRED, moderationActBody } from "@aboutselphy/shared/moderation-act";
import { DEFAULT_ESCALATION, PAGE_SIZE, type ActResult, type CaseQuery, type EditReasonResult, type MemberActionInput, type PardonResult, type SaveSettingsResult, type SettingsInput } from "./schema";

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

/** Everything about one member: the name from the newest case, how many of each kind, the active warnings, and the history (newest first, up to 100). */
export async function getMemberPage(userId: string) {
  const rows = await listCasesForTarget(userId, -1, 100);
  const counts: Record<string, number> = {};
  for (const c of rows) counts[c.type] = (counts[c.type] ?? 0) + 1;
  return { userId, name: rows.find((c) => c.targetName)?.targetName ?? null, rows, counts, activeWarnings: rows.filter((c) => c.type === "warn" && c.active).length };
}

/**
 * A moderation action started on the dashboard. The input is checked again here (the form is only a convenience), the length text is
 * read the way the slash commands read it, and the bot does the rest: its permission and role-order checks, the Discord call, the case
 * under the staff member's name. The bot refuses staff, the owner and itself as targets.
 */
export async function actOnMember(input: MemberActionInput, by: StaffSession["user"]): Promise<ActResult> {
  try {
    if (REASON_REQUIRED.has(input.type) && input.reason === "") return { ok: false, error: "needsReason" };
    let durationSeconds: number | undefined;
    if (input.type === "timeout" || (input.type === "ban" && input.duration !== "")) {
      const seconds = parseDuration(input.duration);
      const [min, max] = input.type === "timeout" ? [MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS] : [MIN_TIMEOUT_SECONDS, MAX_TEMP_BAN_SECONDS];
      if (seconds === null || seconds < min || seconds > max) return { ok: false, error: "badDuration" };
      durationSeconds = seconds;
    }
    const body = moderationActBody.safeParse({
      type: input.type,
      targetId: input.targetId,
      reason: input.reason,
      ...(durationSeconds ? { durationSeconds } : {}),
      ...(input.type === "ban" && input.deleteDays > 0 ? { deleteDays: input.deleteDays } : {}),
      staffName: by.name,
    });
    if (!body.success) return { ok: false, error: "invalid" };

    const result = await moderationActViaBot(body.data);
    if (!result) return { ok: false, error: "botUnavailable" };
    if (!result.ok || result.caseNumber === undefined) return { ok: false, error: "refused", message: result.message };
    return { ok: true, caseNumber: result.caseNumber, message: result.message };
  } catch (error) {
    console.error("[moderation] action failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Staff may correct a reason afterwards; the case shows who changed it and when, and the log message in Discord is refreshed. */
export async function editCaseReason(caseNumber: number, reason: string, by: StaffSession["user"]): Promise<EditReasonResult> {
  try {
    const row = await findCase(caseNumber);
    if (!row) return { ok: false, error: "notFound" };
    // A reason that is required for this kind of case can't be emptied.
    if (reason === "" && (REASON_REQUIRED as ReadonlySet<string>).has(row.type)) return { ok: false, error: "invalid" };
    if ((await editReason(caseNumber, reason || null, by.name)) === 0) return { ok: false, error: "notFound" };
    return { ok: true, logUpdated: (await refreshCaseLog(caseNumber)) === "updated" };
  } catch (error) {
    console.error("[moderation] editing a reason failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
