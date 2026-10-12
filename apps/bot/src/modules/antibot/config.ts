import type { AntiBotConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig } from "./repository";

// Cached in memory. The dashboard asks the bot to drop the cache (POST /internal/reload/antibot);
// the 60 s TTL is the safety net.
const TTL_MS = 60_000;
let cached: { value: AntiBotConfig; at: number } | undefined;

export async function getAntiBotConfig(): Promise<AntiBotConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

onReload("antibot", () => {
  cached = undefined;
});
