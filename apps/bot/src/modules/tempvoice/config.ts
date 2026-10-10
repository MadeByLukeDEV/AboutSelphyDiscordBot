import type { TempVoiceConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig, updateConfig, type ConfigUpdate } from "./repository";

// Cached in memory: every voice-state event reads it, and those are frequent.
// The dashboard asks the bot to drop the cache (POST /internal/reload/tempvoice);
// the TTL is the safety net for when that call doesn't arrive.
const TTL_MS = 60_000;
let cached: { value: TempVoiceConfig; at: number } | undefined;

export async function getTempVoiceConfig(): Promise<TempVoiceConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

export async function saveTempVoiceConfig(data: ConfigUpdate): Promise<TempVoiceConfig> {
  const value = await updateConfig(data);
  cached = { value, at: Date.now() };
  return value;
}

onReload("tempvoice", () => {
  cached = undefined;
});
