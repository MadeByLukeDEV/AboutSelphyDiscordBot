import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { MAX_TWITCH_STREAMERS, TWITCH_REFRESH_TOKEN_PURPOSE } from "@aboutselphy/shared";
import { decryptToken, encryptToken } from "@aboutselphy/shared/token-cipher";
import { env, siteUrl } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, reloadBotModule, resolveTwitchChannel } from "@/modules/bot-api";
import { buildAuthorizationUrl, exchangeCode, refreshAccessToken, revokeToken, TwitchOAuthError, validateToken } from "./oauth";
import {
  countStreamers,
  createStreamer,
  deleteConnection,
  deleteStreamer,
  findStreamer,
  findStreamerByTwitchId,
  listStreamers,
  readConfig,
  readConnection,
  saveConnection,
  setStreamerEnabled,
  updateConfig,
  updateStreamer,
} from "./repository";
import type {
  ConnectOutcome,
  SaveStreamerResult,
  SaveTwitchResult,
  SimpleResult,
  StreamerInput,
  TwitchError,
  TwitchOverview,
  TwitchSettings,
  TwitchStreamerView,
} from "./schema";

export const TWITCH_OAUTH_COOKIE = "tw_oauth";
export const TWITCH_OAUTH_COOKIE_PATH = "/api/twitch";
export const TWITCH_OAUTH_COOKIE_MAX_AGE = 600;

const redirectUri = () => `${siteUrl()}/api/twitch/callback`;

function credentials() {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY } = env();
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TOKEN_ENCRYPTION_KEY) return undefined;
  return { clientId: TWITCH_CLIENT_ID, clientSecret: TWITCH_CLIENT_SECRET, key: TOKEN_ENCRYPTION_KEY };
}

export const canConnectTwitch = () => credentials() !== undefined;

// -- connect ---------------------------------------------------------------------------------

/** The Twitch URL to send the admin to, and the state for the cookie. */
export function startTwitchConnect() {
  const creds = credentials();
  if (!creds) return undefined;
  const state = randomBytes(32).toString("base64url");
  return { url: buildAuthorizationUrl(creds, { redirectUri: redirectUri(), state }), state };
}

function sameString(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Finishes the connect flow. Never throws; the outcome goes back to the page as a code. */
export async function completeTwitchConnect(input: {
  params: URLSearchParams;
  cookie: string | undefined;
  connectedBy: string;
}): Promise<ConnectOutcome> {
  const state = input.params.get("state");
  if (!input.cookie || !state || !sameString(state, input.cookie)) return "invalidState";
  if (input.params.get("error")) return "cancelled";
  const code = input.params.get("code");
  if (!code || code.length > 512) return "invalidState";
  const creds = credentials();
  if (!creds) return "notConfigured";

  try {
    const token = await exchangeCode(creds, code, redirectUri());
    if (!token.refreshToken) {
      await revokeToken(creds, token.accessToken);
      return "noRefreshToken";
    }
    let who: Awaited<ReturnType<typeof validateToken>>;
    try {
      who = await validateToken(token.accessToken);
    } catch (error) {
      await revokeToken(creds, token.accessToken);
      throw error;
    }
    await saveConnection({
      twitchUserId: who.userId,
      login: who.login.slice(0, 64),
      refreshTokenEnc: encryptToken(token.refreshToken, TWITCH_REFRESH_TOKEN_PURPOSE, creds.key),
      connectedByName: input.connectedBy.slice(0, 100),
    });
    // The access token is simply dropped (not revoked: revoking it would end the
    // whole grant, refresh token included). The bot refreshes its own.
    console.info("[twitch] connected", who.login, "by", input.connectedBy);
    await reloadBotModule("twitch");
    return "connected";
  } catch (error) {
    console.error("[twitch] connect failed", errorInfo(error));
    return "failed";
  }
}

const toView = (s: {
  id: string;
  login: string;
  displayName: string;
  channelId: string;
  pingRoleId: string | null;
  messageTemplate: string;
  embedColor: number;
  showThumbnail: boolean;
  showGame: boolean;
  enabled: boolean;
}): TwitchStreamerView => ({
  id: s.id,
  login: s.login,
  displayName: s.displayName,
  channelId: s.channelId,
  pingRoleId: s.pingRoleId,
  messageTemplate: s.messageTemplate,
  embedColor: s.embedColor,
  showThumbnail: s.showThumbnail,
  showGame: s.showGame,
  enabled: s.enabled,
});

// -- page data ----------------------------------------------------------------------------------

export async function getTwitchOverview(): Promise<TwitchOverview> {
  const [config, connection, streamers] = await Promise.all([readConfig(), readConnection(), listStreamers()]);
  return {
    ready: canConnectTwitch(),
    connection: connection
      ? {
          login: connection.login,
          needsReconnect: connection.needsReconnect,
          connectedByName: connection.connectedByName,
          connectedAt: connection.connectedAt.toISOString(),
        }
      : null,
    settings: { enabled: config.enabled, markEndedOnOffline: config.markEndedOnOffline },
    streamers: streamers.map(toView),
  };
}

// -- changes ------------------------------------------------------------------------------------------

export async function saveTwitchSettings(input: TwitchSettings): Promise<SaveTwitchResult> {
  try {
    // Switching on with nothing to announce or nobody connected would silently do nothing.
    if (input.enabled && !(await readConnection())) return { ok: false, error: "notConnected" };
    const saved = await updateConfig(input);
    return { ok: true, settings: { enabled: saved.enabled, markEndedOnOffline: saved.markEndedOnOffline }, botNotified: await reloadBotModule("twitch") };
  } catch (error) {
    console.error("[twitch] saving the settings failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

const fail = (error: TwitchError) => ({ ok: false as const, error });
const isUniqueViolation = (error: unknown) => (error as { code?: unknown } | null)?.code === "P2002";

/**
 * Adds a channel (no id) or changes one (with its id). Nothing from the request is
 * trusted: a new channel is looked up on Twitch through the bot, and the Discord
 * channel and role must exist in the server. If the bot can't answer, a change
 * that needs the check is refused rather than believed.
 */
export async function saveStreamer(input: StreamerInput): Promise<SaveStreamerResult> {
  try {
    const existing = input.id ? await findStreamer(input.id) : null;
    if (input.id && !existing) return fail("notFound");

    const roleId = input.pingRoleId || null;
    const channelChanged = !existing || existing.channelId !== input.channelId;
    const roleChanged = roleId !== null && roleId !== (existing?.pingRoleId ?? null);

    if (channelChanged) {
      const channels = await listChannels(["text"]);
      if (!channels) return fail("botUnavailable");
      if (!channels.some((c) => c.id === input.channelId && c.kind === "text")) return fail("channelNotFound");
    }
    if (roleChanged) {
      const roles = await listRoles();
      if (!roles) return fail("botUnavailable");
      if (!roles.some((r) => r.id === roleId)) return fail("roleNotFound");
    }

    const data = {
      channelId: input.channelId,
      pingRoleId: roleId,
      messageTemplate: input.messageTemplate,
      embedColor: input.embedColor,
      showThumbnail: input.showThumbnail,
      showGame: input.showGame,
      enabled: input.enabled,
    };

    let saved;
    if (existing) {
      saved = await updateStreamer(existing.id, data);
    } else {
      if (!input.login) return fail("invalid");
      if ((await countStreamers()) >= MAX_TWITCH_STREAMERS) return fail("tooManyStreamers");
      const resolved = await resolveTwitchChannel(input.login.replace(/^@/, ""));
      if (!resolved || resolved.status === "unavailable") return fail("botUnavailable");
      if (resolved.status === "notFound") return fail("twitchNotFound");
      const { id, login, displayName } = resolved.channel;
      if (await findStreamerByTwitchId(id)) return fail("alreadyAdded");
      saved = await createStreamer({ twitchUserId: id, login, displayName }, data);
    }
    return { ok: true, streamer: toView(saved), botNotified: await reloadBotModule("twitch") };
  } catch (error) {
    if (isUniqueViolation(error)) return fail("alreadyAdded");
    console.error("[twitch] saving a channel failed", errorInfo(error));
    return fail("failed");
  }
}

export async function removeStreamer(id: string): Promise<SimpleResult> {
  try {
    if ((await deleteStreamer(id)) === 0) return { ok: false, error: "notFound" };
    return { ok: true, botNotified: await reloadBotModule("twitch") };
  } catch (error) {
    console.error("[twitch] removing a channel failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function pauseStreamer(id: string, enabled: boolean): Promise<SimpleResult> {
  try {
    if ((await setStreamerEnabled(id, enabled)) === 0) return { ok: false, error: "notFound" };
    return { ok: true, botNotified: await reloadBotModule("twitch") };
  } catch (error) {
    console.error("[twitch] pausing a channel failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Forgets the login and, best effort, revokes it on Twitch. Switches announcements off first. */
export async function disconnectTwitch(): Promise<SimpleResult> {
  try {
    const creds = credentials();
    const connection = await readConnection();
    if (!connection) return { ok: false, error: "notConnected" };
    const config = await readConfig();
    await updateConfig({ enabled: false, markEndedOnOffline: config.markEndedOnOffline });
    if (creds && !connection.needsReconnect) {
      try {
        const refresh = decryptToken(connection.refreshTokenEnc, TWITCH_REFRESH_TOKEN_PURPOSE, creds.key);
        const access = await refreshAccessToken(creds, refresh);
        await revokeToken(creds, access);
      } catch (error) {
        if (!(error instanceof TwitchOAuthError)) console.warn("[twitch] disconnect: could not revoke on Twitch", errorInfo(error));
      }
    }
    await deleteConnection();
    return { ok: true, botNotified: await reloadBotModule("twitch") };
  } catch (error) {
    console.error("[twitch] disconnect failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
