import type { LevelConfig, LevelReward } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { listRewards, readConfig } from "./repository";

// Cached in memory: every message reads this. The dashboard asks the bot to drop the cache
// (POST /internal/reload/levels); the 60 s TTL is the safety net for when that call doesn't arrive.
const TTL_MS = 60_000;
let cached: { config: LevelConfig; rewards: LevelReward[]; at: number } | undefined;

export async function getLevelConfig(): Promise<{ config: LevelConfig; rewards: LevelReward[] }> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  const [config, rewards] = await Promise.all([readConfig(), listRewards()]);
  cached = { config, rewards, at: Date.now() };
  return cached;
}

onReload("levels", () => {
  cached = undefined;
});
