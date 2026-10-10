import "server-only";
import {
  announcementDeleteStatus,
  announcementEditStatus,
  channelsResponse,
  emojisResponse,
  roleCreateResponse,
  rolePanelDeleteStatus,
  rolePanelPublishStatus,
  refreshCaseResponse,
  rolesResponse,
  tempVoiceOverview,
  twitchResolveResponse,
  type AnnouncementDeleteStatus,
  type AnnouncementEditStatus,
  type ChannelKind,
  type GuildEmoji,
  type RoleCreateResponse,
  type RolePanelDeleteStatus,
  type RolePanelPublishStatus,
  type GuildChannel,
  type GuildRole,
  type RefreshCaseStatus,
  type ReloadModule,
  type TempVoiceOverview,
  type TwitchResolveResponse,
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

/** Roles of the server for a "ping this role" picker, or null if the bot can't be reached. */
export async function listRoles(): Promise<GuildRole[] | null> {
  const res = await botFetch("/internal/guild/roles");
  if (!res?.ok) return null;
  const parsed = rolesResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.roles : null;
}

/** Looks a Twitch channel up by login through the bot (it holds the Twitch token). Null if the bot can't be reached. */
export async function resolveTwitchChannel(login: string): Promise<TwitchResolveResponse | null> {
  const res = await botFetch("/internal/twitch/resolve", { method: "POST", body: { login } });
  if (!res?.ok) return null;
  const parsed = twitchResolveResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

/** Asks the bot to re-render a sent announcement's Discord message. Null if the bot can't be reached. */
export async function editAnnouncementMessage(id: string): Promise<AnnouncementEditStatus | null> {
  const res = await botFetch("/internal/announcements/edit", { method: "POST", body: { id } });
  if (!res?.ok) return null;
  const parsed = announcementEditStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}

/** Asks the bot to delete a sent announcement's Discord message. Null if the bot can't be reached. */
export async function deleteAnnouncementMessage(id: string): Promise<AnnouncementDeleteStatus | null> {
  const res = await botFetch("/internal/announcements/delete", { method: "POST", body: { id } });
  if (!res?.ok) return null;
  const parsed = announcementDeleteStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}

/** Asks the bot to create a cosmetic role (no permissions). Null if the bot can't be reached. */
export async function createGuildRole(
  input: { name: string; color: number; hoist: boolean; mentionable: boolean },
  by: string,
): Promise<RoleCreateResponse | null> {
  const res = await botFetch(`/internal/roles/create?by=${encodeURIComponent(by.slice(0, 60))}`, { method: "POST", body: input });
  if (!res?.ok) return null;
  const parsed = roleCreateResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

/** Asks the bot to post (or update) a role panel's message. Null if the bot can't be reached. */
export async function publishRolePanel(id: string): Promise<RolePanelPublishStatus | null> {
  const res = await botFetch("/internal/rolepanels/publish", { method: "POST", body: { id } });
  if (!res?.ok) return null;
  const parsed = rolePanelPublishStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}

/** Asks the bot to delete a role panel's message. Null if the bot can't be reached. */
export async function deleteRolePanelMessage(id: string): Promise<RolePanelDeleteStatus | null> {
  const res = await botFetch("/internal/rolepanels/delete", { method: "POST", body: { id } });
  if (!res?.ok) return null;
  const parsed = rolePanelDeleteStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}

/** The server's own custom emotes, for the emoji picker. Null if the bot can't be reached. */
export async function listEmojis(): Promise<GuildEmoji[] | null> {
  const res = await botFetch("/internal/guild/emojis");
  if (!res?.ok) return null;
  const parsed = emojisResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.emojis : null;
}
