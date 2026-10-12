import "server-only";
import type { VerificationConfig } from "@aboutselphy/db";
import type { VerificationSettings } from "@aboutselphy/shared/entry";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, postVerificationPanelViaBot, reloadBotModule } from "@/modules/bot-api";
import { readConfig, updateConfig } from "./repository";
import type { PostPanelResult, SaveVerificationResult } from "./schema";

const toSettings = (c: VerificationConfig): VerificationSettings => ({
  enabled: c.enabled,
  channelId: c.channelId ?? "",
  verifiedRoleId: c.verifiedRoleId ?? "",
  unverifiedRoleId: c.unverifiedRoleId ?? "",
  panelTitle: c.panelTitle,
  panelDescription: c.panelDescription,
  buttonLabel: c.buttonLabel,
  question: c.question,
  answer: c.answer,
  minAccountAgeDays: c.minAccountAgeDays,
  kickAfterHours: c.kickAfterHours,
});

/** Settings, whether the panel is posted, and the channels and roles to pick from (null = bot unreachable). */
export async function getVerificationPage() {
  const [config, channels, roles] = await Promise.all([readConfig(), listChannels(["text"]), listRoles()]);
  return { settings: toSettings(config), panelPosted: config.panelMessageId !== null, channels, roles };
}

/** Saves the settings. New channels and roles must exist; the roles must be ones the bot may hand out (checked through the bot, refused if it can't answer). */
export async function saveVerification(input: VerificationSettings): Promise<SaveVerificationResult> {
  try {
    const current = await readConfig();
    if (input.channelId && input.channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    const newRoles = [input.verifiedRoleId, input.unverifiedRoleId].filter((id) => id && id !== current.verifiedRoleId && id !== current.unverifiedRoleId);
    if (newRoles.length > 0) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      for (const id of newRoles) {
        const role = roles.find((r) => r.id === id);
        if (!role) return { ok: false, error: "roleNotFound" };
        if (!role.assignable) return { ok: false, error: "roleNotUsable" };
      }
    }
    // "enabledAt" is the line the unverified-kick never crosses: only members who joined after the gate was switched on can be touched.
    const switchedOn = input.enabled && !current.enabled;
    const saved = await updateConfig({
      enabled: input.enabled,
      channelId: input.channelId || null,
      verifiedRoleId: input.verifiedRoleId || null,
      unverifiedRoleId: input.unverifiedRoleId || null,
      panelTitle: input.panelTitle,
      panelDescription: input.panelDescription,
      buttonLabel: input.buttonLabel,
      question: input.question,
      answer: input.answer,
      minAccountAgeDays: input.minAccountAgeDays,
      kickAfterHours: input.kickAfterHours,
      ...(switchedOn ? { enabledAt: new Date() } : {}),
    });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("verification") };
  } catch (error) {
    console.error("[verification] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Asks the bot to post (or update) the panel from the saved settings. */
export async function postPanel(): Promise<PostPanelResult> {
  try {
    const status = await postVerificationPanelViaBot();
    if (status === null) return { ok: false, error: "botUnavailable" };
    if (status === "posted" || status === "updated") return { ok: true, status };
    return { ok: false, error: status === "needsSetup" ? "needsSetup" : status === "channel" ? "channel" : "failed" };
  } catch (error) {
    console.error("[verification] posting the panel failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
