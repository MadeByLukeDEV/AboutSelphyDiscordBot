import "server-only";
import type { TempVoiceConfig } from "@aboutselphy/db";
import { errorInfo } from "@/lib/log";
import { getTempVoiceOverview, listChannels, reloadBotModule } from "@/modules/bot-api";
import { readConfig, updateConfig } from "./repository";
import type { SaveSettingsResult, SettingsInput } from "./schema";

function toSettings(c: TempVoiceConfig): SettingsInput {
  return {
    enabled: c.enabled,
    lobbyChannelId: c.lobbyChannelId ?? "",
    categoryId: c.categoryId ?? "",
    nameTemplate: c.nameTemplate,
    defaultUserLimit: c.defaultUserLimit,
    allowVideoByDefault: c.allowVideoByDefault,
    allowSoundboardByDefault: c.allowSoundboardByDefault,
    blockedWords: c.blockedWords ?? [],
  };
}

/** The saved settings plus the channels to pick from (null channels = the bot is unreachable). */
export async function getSettings() {
  const [config, channels] = await Promise.all([readConfig(), listChannels(["voice", "category"])]);
  return { settings: toSettings(config), channels };
}

export { getTempVoiceOverview };

export async function saveSettings(input: SettingsInput): Promise<SaveSettingsResult> {
  try {
    const current = await readConfig();
    const lobby = input.lobbyChannelId || null;
    const category = input.categoryId || null;
    const lobbyChanged = lobby !== null && lobby !== current.lobbyChannelId;
    const categoryChanged = category !== null && category !== current.categoryId;

    // A channel ID in a crafted request must not be stored on trust: the lobby has
    // to be a voice channel and the category a category that the bot can see. If
    // the bot can't answer, a change of channel is refused rather than believed.
    if (lobbyChanged || categoryChanged) {
      const channels = await listChannels(["voice", "category"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (lobbyChanged && !channels.some((c) => c.id === lobby && c.kind === "voice")) {
        return { ok: false, error: "lobbyNotFound" };
      }
      if (categoryChanged && !channels.some((c) => c.id === category && c.kind === "category")) {
        return { ok: false, error: "categoryNotFound" };
      }
    }

    const saved = await updateConfig({
      enabled: input.enabled,
      lobbyChannelId: lobby,
      categoryId: category,
      nameTemplate: input.nameTemplate,
      defaultUserLimit: input.defaultUserLimit,
      allowVideoByDefault: input.allowVideoByDefault,
      allowSoundboardByDefault: input.allowSoundboardByDefault,
      blockedWords: input.blockedWords,
    });
    // The bot caches this config (60 s TTL): tell it to drop the cache now.
    const botNotified = await reloadBotModule("tempvoice");
    return { ok: true, settings: toSettings(saved), botNotified };
  } catch (error) {
    console.error("[tempvoice] saving settings failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
