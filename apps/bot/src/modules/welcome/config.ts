import type { WelcomeConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig } from "./repository";

// Cached in memory: every join and leave reads this. The dashboard asks the bot to drop the cache
// (POST /internal/reload/welcome); the 60 s TTL is the safety net for when that call doesn't arrive.
const TTL_MS = 60_000;
let cached: { value: WelcomeConfig; at: number } | undefined;

export async function getWelcomeConfig(): Promise<WelcomeConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

onReload("welcome", () => {
  cached = undefined;
});
