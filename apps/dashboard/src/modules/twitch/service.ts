import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { TWITCH_REFRESH_TOKEN_PURPOSE } from "@aboutselphy/shared";
import { decryptToken, encryptToken } from "@aboutselphy/shared/token-cipher";
import { env, siteUrl } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { reloadBotModule } from "@/modules/bot-api";
import { buildAuthorizationUrl, exchangeCode, refreshAccessToken, revokeToken, TwitchOAuthError, validateToken } from "./oauth";
import {
  deleteConnection,
  deleteStreamer,
  listStreamers,
  readConfig,
  readConnection,
  saveConnection,
  setStreamerEnabled,
  updateConfig,
} from "./repository";
import type { ConnectOutcome, SaveTwitchResult, SimpleResult, TwitchOverview, TwitchSettings } from "./schema";

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
    streamers: streamers.map((s) => ({
      id: s.id,
      login: s.login,
      displayName: s.displayName,
      channelId: s.channelId,
      pingRoleId: s.pingRoleId,
      enabled: s.enabled,
    })),
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
