import { prisma } from "@aboutselphy/db";
import type { ModuleKey } from "@aboutselphy/shared/modules";
import { onReload } from "../internal-api/reload";
import { log } from "./log";

// The central on/off switches. Cached in memory (every message and command asks); the dashboard asks
// the bot to drop the cache (POST /internal/reload/modules) and the 60 s TTL is the safety net. If the
// database can't be read, the last known answer is used (or "on" when there is none): a database
// hiccup must never switch features off.
const TTL_MS = 60_000;
let cached: { off: Set<string>; at: number } | undefined;

async function load(): Promise<Set<string>> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.off;
  try {
    const rows = await prisma.moduleFlag.findMany({ where: { enabled: false }, select: { key: true } });
    cached = { off: new Set(rows.map((r) => r.key)), at: Date.now() };
  } catch (err) {
    log.warn({ err }, "modules: could not read the switches, using the last known state");
    cached = { off: cached?.off ?? new Set(), at: Date.now() - TTL_MS + 5000 };
  }
  return cached.off;
}

/** Is this feature switched on? (Features without a row are on.) */
export async function moduleOn(key: ModuleKey): Promise<boolean> {
  return !(await load()).has(key);
}

onReload("modules", () => {
  cached = undefined;
});
