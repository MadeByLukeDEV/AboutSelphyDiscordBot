import type { TwitchVipConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig } from "./repository";

// Cached in memory. The dashboard asks the bot to drop the cache and sync (POST /internal/reload/twitchvip);
// the 60 s TTL is the safety net.
const TTL_MS = 60_000;
let cached: { value: TwitchVipConfig; at: number } | undefined;

export async function getVipConfig(): Promise<TwitchVipConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

export const dropVipConfig = () => {
  cached = undefined;
};

onReload("twitchvip", dropVipConfig);
