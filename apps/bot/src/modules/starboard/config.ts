import type { StarboardConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig } from "./repository";

// Cached in memory: every reaction on the server reads this. The dashboard asks the bot to drop the
// cache (POST /internal/reload/starboard); the 60 s TTL is the safety net.
const TTL_MS = 60_000;
let cached: { value: StarboardConfig; at: number } | undefined;

export async function getStarboardConfig(): Promise<StarboardConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

onReload("starboard", () => {
  cached = undefined;
});
