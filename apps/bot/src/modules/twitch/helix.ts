import { z } from "zod";

// Twitch's HTTP API (Helix) and OAuth token endpoint, as thin typed calls.
// Failures are a TwitchError with a short code and the HTTP status: never the
// response body, never a token. Every call has a timeout.

const TIMEOUT_MS = 10_000;

export type TwitchErrorCode = "invalidGrant" | "unauthorized" | "rateLimited" | "rejected" | "failed";

export class TwitchError extends Error {
  constructor(
    readonly code: TwitchErrorCode,
    readonly status?: number,
  ) {
    super(`twitch: ${code}${status ? ` (${status})` : ""}`);
    this.name = "TwitchError";
  }
}

export type Credentials = { clientId: string; clientSecret: string };

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new TwitchError("failed");
  }
}

// -- OAuth ----------------------------------------------------------------------------

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
});

export type UserToken = { accessToken: string; refreshToken: string | undefined; expiresInSeconds: number };

/** Trades a refresh token for a new access token (Twitch rotates the refresh token: store the new one). */
export async function refreshUserToken(credentials: Credentials, refreshToken: string): Promise<UserToken> {
  const response = await send("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (response.status === 400 || response.status === 401) throw new TwitchError("invalidGrant", response.status);
  if (!response.ok) throw new TwitchError("failed", response.status);
  const parsed = tokenResponse.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new TwitchError("failed", response.status);
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresInSeconds: parsed.data.expires_in,
  };
}

// -- Helix ----------------------------------------------------------------------------

async function helix(credentials: Credentials, accessToken: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await send(`https://api.twitch.tv/helix/${path}`, {
    ...init,
    headers: { "Client-Id": credentials.clientId, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
  if (response.ok) return response;
  if (response.status === 401) throw new TwitchError("unauthorized", 401);
  if (response.status === 429) throw new TwitchError("rateLimited", 429);
  if (response.status >= 400 && response.status < 500) throw new TwitchError("rejected", response.status);
  throw new TwitchError("failed", response.status);
}

const users = z.object({ data: z.array(z.object({ id: z.string(), login: z.string(), display_name: z.string() })) });
export type TwitchUser = { id: string; login: string; displayName: string };

/** Looks channels up by login name (case-insensitive). Unknown logins are simply missing from the result. */
export async function getUsersByLogin(credentials: Credentials, accessToken: string, logins: string[]): Promise<TwitchUser[]> {
  if (logins.length === 0) return [];
  const query = logins.slice(0, 100).map((l) => `login=${encodeURIComponent(l)}`).join("&");
  const parsed = users.safeParse(await (await helix(credentials, accessToken, `users?${query}`)).json().catch(() => undefined));
  if (!parsed.success) throw new TwitchError("failed");
  return parsed.data.data.map((u) => ({ id: u.id, login: u.login, displayName: u.display_name }));
}

const streams = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      user_id: z.string(),
      user_login: z.string(),
      user_name: z.string(),
      game_name: z.string().default(""),
      type: z.string(),
      title: z.string().default(""),
      viewer_count: z.number().default(0),
      started_at: z.string(),
      thumbnail_url: z.string().default(""),
    }),
  ),
});
export type LiveStream = {
  id: string;
  userId: string;
  login: string;
  name: string;
  game: string;
  title: string;
  viewers: number;
  startedAt: Date;
  thumbnailUrl: string;
};

/** Currently live streams among the given channels (offline channels are absent). */
export async function getLiveStreams(credentials: Credentials, accessToken: string, userIds: string[]): Promise<LiveStream[]> {
  if (userIds.length === 0) return [];
  const query = userIds.slice(0, 100).map((id) => `user_id=${encodeURIComponent(id)}`).join("&");
  const parsed = streams.safeParse(await (await helix(credentials, accessToken, `streams?${query}&first=100`)).json().catch(() => undefined));
  if (!parsed.success) throw new TwitchError("failed");
  return parsed.data.data
    .filter((s) => s.type === "live")
    .map((s) => ({
      id: s.id,
      userId: s.user_id,
      login: s.user_login,
      name: s.user_name,
      game: s.game_name,
      title: s.title,
      viewers: s.viewer_count,
      startedAt: new Date(s.started_at),
      thumbnailUrl: s.thumbnail_url,
    }));
}

const vips = z.object({
  data: z.array(z.object({ user_id: z.string(), user_login: z.string() })),
  pagination: z.object({ cursor: z.string().optional() }).optional(),
});
export type ChannelVip = { id: string; login: string };

/** The VIPs of the broadcaster's channel. Needs that broadcaster's token with the channel:read:vips scope (Twitch answers 401 without it). */
export async function getVips(credentials: Credentials, accessToken: string, broadcasterId: string): Promise<ChannelVip[]> {
  const result: ChannelVip[] = [];
  let after = "";
  for (let page = 0; page < 10; page++) {
    const query = `channels/vips?broadcaster_id=${encodeURIComponent(broadcasterId)}&first=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const parsed = vips.safeParse(await (await helix(credentials, accessToken, query)).json().catch(() => undefined));
    if (!parsed.success) throw new TwitchError("failed");
    result.push(...parsed.data.data.map((v) => ({ id: v.user_id, login: v.user_login })));
    after = parsed.data.pagination?.cursor ?? "";
    if (!after) break;
  }
  return result;
}

/** Subscribes this WebSocket session to one event for one channel. "Already exists" counts as success. */
export async function subscribe(
  credentials: Credentials,
  accessToken: string,
  type: "stream.online" | "stream.offline",
  broadcasterId: string,
  sessionId: string,
): Promise<void> {
  try {
    await helix(credentials, accessToken, "eventsub/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        type,
        version: "1",
        condition: { broadcaster_user_id: broadcasterId },
        transport: { method: "websocket", session_id: sessionId },
      }),
    });
  } catch (err) {
    if (err instanceof TwitchError && err.status === 409) return; // already subscribed on this session
    throw err;
  }
}
