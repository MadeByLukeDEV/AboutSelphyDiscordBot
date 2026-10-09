import type { ModConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig, updateConfig } from "./repository";

// Cached in memory with a short TTL. The dashboard also asks the bot to drop
// the cache (POST /internal/reload/moderation), but that only reaches this
// process, so the TTL is the safety net.
const TTL_MS = 60_000;
let cached: { value: ModConfig; at: number } | undefined;

export async function getModConfig(): Promise<ModConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

export async function saveModConfig(data: Partial<Pick<ModConfig, "logChannelId" | "dmOnAction">>) {
  const value = await updateConfig(data);
  cached = { value, at: Date.now() };
  return value;
}

onReload("moderation", () => {
  cached = undefined;
});
