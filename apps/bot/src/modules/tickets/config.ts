import type { TicketConfig } from "@aboutselphy/db";
import { onReload } from "../../internal-api/reload";
import { readConfig } from "./repository";

// Cached in memory: every ticket button press reads this. The dashboard asks the bot to drop the
// cache (POST /internal/reload/tickets); the 60 s TTL is the safety net.
const TTL_MS = 60_000;
let cached: { value: TicketConfig; at: number } | undefined;

export async function getTicketConfig(): Promise<TicketConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = await readConfig();
  cached = { value, at: Date.now() };
  return value;
}

onReload("tickets", () => {
  cached = undefined;
});
