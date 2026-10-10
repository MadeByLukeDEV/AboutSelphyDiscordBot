import type { TempVoiceConfig, TempVoiceLobby } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import {
  createLobby,
  deleteLobby,
  listLobbies,
  readConfig,
  updateConfig,
  updateLobby,
  type ConfigUpdate,
  type LobbyFields,
} from "./repository";

// Cached in memory: every voice-state event reads this, and those are frequent.
// The dashboard asks the bot to drop the cache (POST /internal/reload/tempvoice);
// the TTL is the safety net for when that call doesn't arrive.
const TTL_MS = 60_000;
let config: { value: TempVoiceConfig; at: number } | undefined;
let lobbies: { value: TempVoiceLobby[]; at: number } | undefined;

const fresh = (entry: { at: number } | undefined) => entry !== undefined && Date.now() - entry.at < TTL_MS;

export async function getTempVoiceConfig(): Promise<TempVoiceConfig> {
  if (config && fresh(config)) return config.value;
  const value = await readConfig();
  config = { value, at: Date.now() };
  return value;
}

export async function getLobbies(): Promise<TempVoiceLobby[]> {
  if (lobbies && fresh(lobbies)) return lobbies.value;
  const value = await listLobbies();
  lobbies = { value, at: Date.now() };
  return value;
}

/** The lobby for a voice channel, or undefined if that channel isn't a lobby. */
export async function findLobby(channelId: string): Promise<TempVoiceLobby | undefined> {
  return (await getLobbies()).find((l) => l.channelId === channelId);
}

export async function saveTempVoiceConfig(data: ConfigUpdate): Promise<TempVoiceConfig> {
  const value = await updateConfig(data);
  config = { value, at: Date.now() };
  return value;
}

export async function addLobby(channelId: string, fields: Partial<LobbyFields> = {}): Promise<TempVoiceLobby> {
  const created = await createLobby(channelId, fields);
  lobbies = undefined;
  return created;
}

export async function saveLobby(channelId: string, fields: Partial<LobbyFields>): Promise<TempVoiceLobby> {
  const updated = await updateLobby(channelId, fields);
  lobbies = undefined;
  return updated;
}

export async function removeLobby(channelId: string): Promise<boolean> {
  const removed = await deleteLobby(channelId);
  lobbies = undefined;
  return removed;
}

onReload("tempvoice", () => {
  config = undefined;
  lobbies = undefined;
});
