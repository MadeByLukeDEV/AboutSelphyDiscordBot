import type { ReminderConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig } from "./repository";

// Cached in memory. The dashboard asks the bot to drop the cache (POST /internal/reload/reminders);
// the 60 s TTL is the safety net.
const TTL_MS = 60_000;
let cached: { value: ReminderConfig; at: number } | undefined;

export async function getReminderConfig(): Promise<ReminderConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

onReload("reminders", () => {
  cached = undefined;
});
