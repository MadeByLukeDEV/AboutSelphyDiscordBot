import "server-only";
import type { WelcomeConfig } from "@aboutselphy/db";
import type { WelcomeSettings } from "@aboutselphy/shared/welcome";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { readConfig, updateConfig } from "./repository";
import type { SaveWelcomeResult } from "./schema";

const toSettings = (c: WelcomeConfig): WelcomeSettings => ({
  autoRoleIds: c.autoRoleIds,
  botAutoRoleIds: c.botAutoRoleIds,
  restoreRoles: c.restoreRoles,
  welcomeEnabled: c.welcomeEnabled,
  welcomeChannelId: c.welcomeChannelId ?? "",
  welcomeTemplate: c.welcomeTemplate,
  welcomeAsEmbed: c.welcomeAsEmbed,
  welcomeColor: c.welcomeColor,
  welcomeImageUrl: c.welcomeImageUrl,
  dmEnabled: c.dmEnabled,
  dmTemplate: c.dmTemplate,
  goodbyeEnabled: c.goodbyeEnabled,
  goodbyeChannelId: c.goodbyeChannelId ?? "",
  goodbyeTemplate: c.goodbyeTemplate,
});

/** The settings plus the channels and roles to pick from (null = the bot can't be reached). */
export async function getWelcomePage() {
  const [config, channels, roles] = await Promise.all([readConfig(), listChannels(["text"]), listRoles()]);
  return { settings: toSettings(config), channels, roles };
}

/**
 * Saves the settings. Channels must be text channels of the server, and every auto-role a
 * role the bot may hand out (its own list says so). A role or channel that is already saved
 * stays valid without a lookup, so a settings change still works while the bot is down; a new
 * one needs the bot to answer. The bot checks each role again every time someone joins.
 */
export async function saveWelcome(input: WelcomeSettings): Promise<SaveWelcomeResult> {
  try {
    const current = await readConfig();
    const newChannels = [input.welcomeChannelId, input.goodbyeChannelId].filter((id) => id && id !== current.welcomeChannelId && id !== current.goodbyeChannelId);
    const newRoles = [...input.autoRoleIds, ...input.botAutoRoleIds].filter((id) => !current.autoRoleIds.includes(id) && !current.botAutoRoleIds.includes(id));

    if (newChannels.length > 0) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (newChannels.some((id) => !channels.some((c) => c.id === id))) return { ok: false, error: "channelNotFound" };
    }
    if (newRoles.length > 0) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      for (const id of newRoles) {
        const known = roles.find((r) => r.id === id);
        if (!known) return { ok: false, error: "roleNotFound" };
        if (!known.assignable) return { ok: false, error: "roleNotAllowed" };
      }
    }

    const saved = await updateConfig({
      autoRoleIds: input.autoRoleIds,
      botAutoRoleIds: input.botAutoRoleIds,
      restoreRoles: input.restoreRoles,
      welcomeEnabled: input.welcomeEnabled,
      welcomeChannelId: input.welcomeChannelId || null,
      welcomeTemplate: input.welcomeTemplate,
      welcomeAsEmbed: input.welcomeAsEmbed,
      welcomeColor: input.welcomeColor,
      welcomeImageUrl: input.welcomeImageUrl.trim(),
      dmEnabled: input.dmEnabled,
      dmTemplate: input.dmTemplate,
      goodbyeEnabled: input.goodbyeEnabled,
      goodbyeChannelId: input.goodbyeChannelId || null,
      goodbyeTemplate: input.goodbyeTemplate,
    });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("welcome") };
  } catch (error) {
    console.error("[welcome] saving the settings failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
