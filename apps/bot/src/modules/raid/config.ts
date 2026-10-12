import type { RaidConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig } from "./repository";

// Cached in memory: every join reads this. The dashboard asks the bot to drop the cache
// (POST /internal/reload/raid); the 60 s TTL is the safety net.
const TTL_MS = 60_000;
let cached: { value: RaidConfig; at: number } | undefined;

export async function getRaidConfig(): Promise<RaidConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

export const dropRaidConfig = () => {
  cached = undefined;
};

onReload("raid", dropRaidConfig);
