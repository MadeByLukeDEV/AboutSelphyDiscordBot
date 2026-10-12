import type { VerificationConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig } from "./repository";

// Cached in memory: every join and every press reads this. The dashboard asks the bot to drop the cache
// (POST /internal/reload/verification); the 60 s TTL is the safety net.
const TTL_MS = 60_000;
let cached: { value: VerificationConfig; at: number } | undefined;

export async function getVerificationConfig(): Promise<VerificationConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

onReload("verification", () => {
  cached = undefined;
});
