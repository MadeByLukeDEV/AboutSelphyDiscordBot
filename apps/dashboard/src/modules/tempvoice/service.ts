import "server-only";
import type { TempVoiceConfig, TempVoiceLobby } from "@aboutselphy/db";
import { MAX_TEMP_VOICE_LOBBIES } from "@aboutselphy/shared";
import { errorInfo } from "@/lib/log";
import { getTempVoiceOverview, listChannels, reloadBotModule } from "@/modules/bot-api";
import {
  countLobbies,
  createLobby,
  deleteLobby,
  findLobby,
  findLobbyByChannel,
  isRoomChannel,
  listLobbies,
  readConfig,
  updateConfig,
  updateLobby,
  type LobbyData,
} from "./repository";
import {
  isTemplateBlocked,
  type DeleteLobbyResult,
  type GlobalSettings,
  type LobbyInput,
  type LobbyView,
  type SaveGlobalResult,
  type SaveLobbyResult,
  type SettingsError,
} from "./schema";

const toGlobal = (c: TempVoiceConfig): GlobalSettings => ({
  enabled: c.enabled,
  blockedWords: c.blockedWords ?? [],
  useDefaultBlocklist: c.useDefaultBlocklist,
});

const toLobbyView = (l: TempVoiceLobby): LobbyView => ({
  id: l.id,
  channelId: l.channelId,
  categoryId: l.categoryId ?? "",
  nameTemplate: l.nameTemplate,
  defaultUserLimit: l.defaultUserLimit,
  allowVideoByDefault: l.allowVideoByDefault,
  allowSoundboardByDefault: l.allowSoundboardByDefault,
  enabled: l.enabled,
});

export { getTempVoiceOverview };

/** Everything the page needs. `channels` is null when the bot can't be reached. */
export async function getSettings() {
  const [config, lobbies, channels] = await Promise.all([readConfig(), listLobbies(), listChannels(["voice", "category"])]);
  return { global: toGlobal(config), lobbies: lobbies.map(toLobbyView), channels };
}

const fail = (error: SettingsError) => ({ ok: false as const, error });

/** Prisma's "unique constraint failed": two admins adding the same channel at once. */
const isUniqueViolation = (error: unknown) => (error as { code?: unknown } | null)?.code === "P2002";

export async function saveGlobal(input: GlobalSettings): Promise<SaveGlobalResult> {
  try {
    // Switching on with nothing to join would silently do nothing: say so instead.
    if (input.enabled && (await countLobbies()) === 0) return fail("needsLobby");

    const saved = await updateConfig(input);
    // The bot caches this config (60 s TTL): tell it to drop the cache now.
    return { ok: true, settings: toGlobal(saved), botNotified: await reloadBotModule("tempvoice") };
  } catch (error) {
    console.error("[tempvoice] saving the general settings failed", errorInfo(error));
    return fail("failed");
  }
}

/**
 * Creates a lobby (no id) or updates one (with its id). A new lobby's channel
 * must be a real voice channel the bot can see, and a category must be a real
 * category: IDs in a crafted request are never stored on trust, and if the bot
 * can't answer, a channel change is refused rather than believed.
 */
export async function saveLobby(input: LobbyInput): Promise<SaveLobbyResult> {
  try {
    const config = await readConfig();
    if (isTemplateBlocked(input.nameTemplate, { blockedWords: config.blockedWords ?? [], useDefaultBlocklist: config.useDefaultBlocklist })) {
      return fail("templateBlocked");
    }

    const existing = input.id ? await findLobby(input.id) : null;
    if (input.id && !existing) return fail("notFound");
    // The channel is what makes it this lobby; moving one means remove + add.
    if (existing && existing.channelId !== input.channelId) return fail("invalid");

    if (!existing) {
      if ((await countLobbies()) >= MAX_TEMP_VOICE_LOBBIES) return fail("tooManyLobbies");
      if ((await findLobbyByChannel(input.channelId)) || (await isRoomChannel(input.channelId))) return fail("alreadyALobby");
    }

    const category = input.categoryId || null;
    const categoryChanged = category !== null && category !== (existing?.categoryId ?? null);
    if (!existing || categoryChanged) {
      const channels = await listChannels(["voice", "category"]);
      if (!channels) return fail("botUnavailable");
      if (!existing && !channels.some((c) => c.id === input.channelId && c.kind === "voice")) return fail("lobbyNotFound");
      if (categoryChanged && !channels.some((c) => c.id === category && c.kind === "category")) return fail("categoryNotFound");
    }

    const data: LobbyData = {
      categoryId: category,
      nameTemplate: input.nameTemplate,
      defaultUserLimit: input.defaultUserLimit,
      allowVideoByDefault: input.allowVideoByDefault,
      allowSoundboardByDefault: input.allowSoundboardByDefault,
      enabled: input.enabled,
    };
    const saved = existing ? await updateLobby(existing.id, data) : await createLobby(input.channelId, data);
    return { ok: true, lobby: toLobbyView(saved), botNotified: await reloadBotModule("tempvoice") };
  } catch (error) {
    if (isUniqueViolation(error)) return fail("alreadyALobby");
    console.error("[tempvoice] saving a lobby failed", errorInfo(error));
    return fail("failed");
  }
}

/** Removes a lobby. Rooms already open stay until they are empty. */
export async function removeLobby(id: string): Promise<DeleteLobbyResult> {
  try {
    if ((await deleteLobby(id)) === 0) return fail("notFound");
    return { ok: true, botNotified: await reloadBotModule("tempvoice") };
  } catch (error) {
    console.error("[tempvoice] removing a lobby failed", errorInfo(error));
    return fail("failed");
  }
}
