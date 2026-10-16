import "server-only";
import type { ScreeningConfig, ScreeningEntry } from "@aboutselphy/db";
import type { ScreeningDecision, ScreeningSettings } from "@aboutselphy/shared/screening";
import { errorInfo } from "@/lib/log";
import { decideScreeningViaBot, listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { listEntries, readConfig, updateConfig } from "./repository";
import type { DecideScreeningResult, SaveScreeningResult, ScreeningEntryStatus, ScreeningRow } from "./schema";

const toSettings = (c: ScreeningConfig): ScreeningSettings => ({ enabled: c.enabled, channelId: c.channelId ?? "", approvedRoleId: c.approvedRoleId ?? "", pendingRoleId: c.pendingRoleId ?? "", autoRejectDays: c.autoRejectDays });

const toRow = (e: ScreeningEntry): ScreeningRow => ({
  id: e.id,
  userId: e.userId,
  userName: e.userName,
  accountCreatedAt: e.accountCreatedAt.toISOString(),
  joinedAt: e.joinedAt.toISOString(),
  status: e.status as ScreeningEntryStatus,
  decidedByName: e.decidedByName,
  decidedAt: e.decidedAt?.toISOString() ?? null,
});

/** Settings, the queue, and the channels and roles to pick from (null = bot unreachable). */
export async function getScreeningPage() {
  const [config, entries, channels, roles] = await Promise.all([readConfig(), listEntries(), listChannels(["text"]), listRoles()]);
  return { settings: toSettings(config), entries: entries.map(toRow), channels, roles };
}

/** Saves the settings. New channels and roles must exist, and the roles must be ones the bot may hand out. */
export async function saveScreening(input: ScreeningSettings): Promise<SaveScreeningResult> {
  try {
    const current = await readConfig();
    if (input.channelId && input.channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    const newRoles = [input.approvedRoleId, input.pendingRoleId].filter((id) => id && id !== current.approvedRoleId && id !== current.pendingRoleId);
    if (newRoles.length > 0) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      for (const id of newRoles) {
        const role = roles.find((r) => r.id === id);
        if (!role) return { ok: false, error: "roleNotFound" };
        if (!role.assignable) return { ok: false, error: "roleNotUsable" };
      }
    }
    const saved = await updateConfig({ enabled: input.enabled, channelId: input.channelId || null, approvedRoleId: input.approvedRoleId || null, pendingRoleId: input.pendingRoleId || null, autoRejectDays: input.autoRejectDays });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("screening") };
  } catch (error) {
    console.error("[screening] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** A staff member decides on an entry; the bot gives the role or kicks, and updates the card. */
export async function decideEntry(id: string, decision: ScreeningDecision, staffName: string): Promise<DecideScreeningResult> {
  try {
    const status = await decideScreeningViaBot({ id, decision, staffName });
    if (status === null) return { ok: false, error: "botUnavailable" };
    if (status === "done") return { ok: true };
    return { ok: false, error: status };
  } catch (error) {
    console.error("[screening] deciding failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
