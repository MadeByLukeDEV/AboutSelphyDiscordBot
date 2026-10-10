import { prisma } from "@aboutselphy/db";
import type { LogCategory } from "@aboutselphy/shared/logs";
import { onReload } from "../../internal-api/reload";

// Where each kind of log goes. Cached in memory: every join, voice move and role change reads this.
// The dashboard asks the bot to drop the cache (POST /internal/reload/logs); the 60 s TTL is the
// safety net for when that call doesn't arrive.
const TTL_MS = 60_000;
type Routes = Map<string, { enabled: boolean; channelId: string | null }>;
let cached: { value: Routes; at: number } | undefined;

async function load(): Promise<Routes> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const rows = await prisma.logRoute.findMany();
  const value: Routes = new Map(rows.map((r) => [r.category, { enabled: r.enabled, channelId: r.channelId }]));
  cached = { value, at: Date.now() };
  return value;
}

/** The channel to post a kind of log in, or null if that kind is switched off or has no channel. */
export async function logChannelFor(category: LogCategory): Promise<string | null> {
  const route = (await load()).get(category);
  return route?.enabled && route.channelId ? route.channelId : null;
}

onReload("logs", () => {
  cached = undefined;
});
