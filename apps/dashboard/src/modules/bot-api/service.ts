import "server-only";
import {
  channelsResponse,
  refreshCaseResponse,
  tempVoiceOverview,
  type ChannelKind,
  type GuildChannel,
  type RefreshCaseStatus,
  type ReloadModule,
  type TempVoiceOverview,
} from "@aboutselphy/shared";
import { env } from "@/lib/env";
import { errorInfo } from "@/lib/log";

// The dashboard never talks to Discord. Everything that needs Discord goes
// through the bot's internal API (bearer secret, internal network only), with a
// short timeout so a down bot can't hang a page or an action. Every function
// returns null / false when the bot is unreachable and lets the caller decide.

const TIMEOUT_MS = 4000;

async function botFetch(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}) {
  try {
    const { BOT_API_URL, BOT_API_SECRET } = env();
    const res = await fetch(new URL(path, BOT_API_URL), {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${BOT_API_SECRET}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return res;
  } catch (error) {
    console.warn("[bot-api] bot unreachable", path, errorInfo(error));
    return null;
  }
}

/** Channels of the server for pickers, or null if the bot can't be reached. */
export async function listChannels(kinds: ChannelKind[]): Promise<GuildChannel[] | null> {
  const res = await botFetch(`/internal/guild/channels?kinds=${kinds.join(",")}`);
  if (!res?.ok) return null;
  const parsed = channelsResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.channels : null;
}

/** The open temporary voice rooms and what the bot lacks to run them, or null if the bot can't be reached. */
export async function getTempVoiceOverview(): Promise<TempVoiceOverview | null> {
  const res = await botFetch("/internal/tempvoice/overview");
  if (!res?.ok) return null;
  const parsed = tempVoiceOverview.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

/** Asks the bot to drop its cached config for a module. False if it couldn't be told. */
export async function reloadBotModule(module: ReloadModule): Promise<boolean> {
  const res = await botFetch(`/internal/reload/${module}`, { method: "POST" });
  return res?.ok ?? false;
}

/** Asks the bot to re-render a case's log embed. Null if the bot can't be reached. */
export async function refreshCaseLog(caseNumber: number): Promise<RefreshCaseStatus | null> {
  const res = await botFetch("/internal/moderation/refresh-case", { method: "POST", body: { caseNumber } });
  if (!res?.ok) return null;
  const parsed = refreshCaseResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.status : null;
}
