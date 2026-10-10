import "server-only";
import {
  announcementDeleteStatus,
  announcementEditStatus,
  channelsResponse,
  suggestionDecideStatus,
  giveawayActionStatus,
  pollActionStatus,
  manageRolesResponse,
  roleDeleteResponse,
  roleMergeResponse,
  roleUpdateStatus,
  ticketPanelStatus,
  welcomePreviewResponse,
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
  type SuggestionDecideStatus,
  type GiveawayActionStatus,
  type PollActionStatus,
  type ManagedRole,
  type RoleDeleteResponse,
  type RoleMergeResponse,
  type RoleUpdateStatus,
  type TicketPanelStatus,
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
import type { GiveawayAction } from "@aboutselphy/shared/giveaways";
import { env } from "@/lib/env";
import { errorInfo } from "@/lib/log";

// The dashboard never talks to Discord. Everything that needs Discord goes
// through the bot's internal API (bearer secret, internal network only), with a
// short timeout so a down bot can't hang a page or an action. Every function
// returns null / false when the bot is unreachable and lets the caller decide.

const TIMEOUT_MS = 4000;

async function botFetch(path: string, init: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}) {
  try {
    const { BOT_API_URL, BOT_API_SECRET } = env();
    const res = await fetch(new URL(path, BOT_API_URL), {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${BOT_API_SECRET}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
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

/** A sample welcome card drawn by the bot from the saved settings (PNG bytes). Null if the bot can't be reached. */
export async function getWelcomePreviewCard(): Promise<Uint8Array | null> {
  const res = await botFetch("/internal/welcome/preview", { method: "POST" });
  if (!res?.ok) return null;
  const parsed = welcomePreviewResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? new Uint8Array(Buffer.from(parsed.data.png, "base64")) : null;
}

/** Asks the bot to post (or update) the ticket panel message. Null if the bot can't be reached. */
export async function postTicketPanel(): Promise<TicketPanelStatus | null> {
  const res = await botFetch("/internal/tickets/panel", { method: "POST" });
  if (!res?.ok) return null;
  const parsed = ticketPanelStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}

/** Asks the bot to start, end, re-roll or cancel a giveaway. Null if the bot can't be reached. */
export async function giveawayAction(id: string, action: GiveawayAction): Promise<GiveawayActionStatus | null> {
  const res = await botFetch("/internal/giveaways/action", { method: "POST", body: { id, action } });
  if (!res?.ok) return null;
  const parsed = giveawayActionStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}

/** Asks the bot to start or end a poll, or remove its post. Null if the bot can't be reached. */
export async function pollAction(id: string, action: "start" | "end" | "delete"): Promise<PollActionStatus | null> {
  const res = await botFetch("/internal/polls/action", { method: "POST", body: { id, action } });
  if (!res?.ok) return null;
  const parsed = pollActionStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}

/** Renames and/or recolours a role (the bot re-checks it). Null if the bot can't be reached. */
export async function updateRoleViaBot(input: { id: string; name?: string; color?: number }, by: string): Promise<RoleUpdateStatus | null> {
  const res = await botFetch("/internal/roles/update", { method: "POST", body: { ...input, by: by.slice(0, 60) || "the dashboard" } });
  if (!res?.ok) return null;
  const parsed = roleUpdateStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}

/** Merges roles (the bot re-checks everything). Null if the bot can't be reached. */
export async function mergeRolesViaBot(input: { sourceIds: string[]; targetId: string; deleteSources: boolean }, by: string): Promise<RoleMergeResponse | null> {
  const res = await botFetch("/internal/roles/merge", { method: "POST", body: { ...input, by: by.slice(0, 60) || "the dashboard" }, timeoutMs: 300_000 });
  if (!res?.ok) return null;
  const parsed = roleMergeResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

/** A member of the server by ID. Undefined = the bot can't be reached, null = no such member. */
export async function getGuildMemberName(id: string): Promise<{ id: string; name: string } | null | undefined> {
  const res = await botFetch(`/internal/guild/member?id=${encodeURIComponent(id)}`);
  if (!res) return undefined;
  if (res.status === 404) return null;
  if (!res.ok) return undefined;
  const body = (await res.json().catch(() => null)) as { member?: { id?: unknown; name?: unknown } } | null;
  return typeof body?.member?.id === "string" && typeof body.member.name === "string" ? { id: body.member.id, name: body.member.name } : undefined;
}

/** Every role with its member count, for the role manager. Null if the bot can't be reached. */
export async function listManagedRoles(): Promise<ManagedRole[] | null> {
  const res = await botFetch("/internal/roles/manage");
  if (!res?.ok) return null;
  const parsed = manageRolesResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.roles : null;
}

/** Asks the bot to delete roles (it re-checks every one). Null if the bot can't be reached. */
export async function deleteRolesViaBot(ids: string[], by: string): Promise<RoleDeleteResponse["results"] | null> {
  const res = await botFetch("/internal/roles/delete", { method: "POST", body: { ids, by: by.slice(0, 60) || "the dashboard" }, timeoutMs: 120_000 });
  if (!res?.ok) return null;
  const parsed = roleDeleteResponse.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.results : null;
}

/** A team member's decision on a suggestion, carried out by the bot (it edits the post and tells the author). Null if the bot can't be reached. */
export async function decideSuggestionViaBot(input: { id: string; status: "approved" | "denied" | "implemented"; reason: string; by: string }): Promise<SuggestionDecideStatus | null> {
  const res = await botFetch("/internal/suggestions/decide", { method: "POST", body: input });
  if (!res?.ok) return null;
  const parsed = suggestionDecideStatus.safeParse((await res.json().catch(() => null))?.status);
  return parsed.success ? parsed.data : null;
}
