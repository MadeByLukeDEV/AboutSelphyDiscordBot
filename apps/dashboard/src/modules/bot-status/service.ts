import "server-only";
import { botHealth, type BotHealth } from "@aboutselphy/shared";
import { env } from "@/lib/env";
import { errorInfo } from "@/lib/log";

export type BotStatus = { online: false } | { online: true; health: BotHealth };

/**
 * The bot's GET /health over the internal network, with a short timeout: a down
 * or slow bot must never hang the dashboard. The bot answers 503 with the same
 * body when it's up but degraded (gateway or DB down), so that's parsed too.
 */
export async function getBotStatus(): Promise<BotStatus> {
  try {
    const res = await fetch(new URL("/health", env().BOT_API_URL), {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.status !== 200 && res.status !== 503) return { online: false };
    const parsed = botHealth.safeParse(await res.json());
    return parsed.success ? { online: true, health: parsed.data } : { online: false };
  } catch (error) {
    console.warn("[bot-status] bot unreachable", errorInfo(error));
    return { online: false };
  }
}
