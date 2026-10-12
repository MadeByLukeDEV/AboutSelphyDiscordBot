import "server-only";
import { z } from "zod";

// Twitch's OAuth endpoints, used for the one-time "Connect Twitch" login.
// The grant asks for NO scopes: EventSub's stream.online / stream.offline only
// need a user access token, so what we store can do nothing else. Failures
// are short codes; tokens never appear in errors or logs.

const TIMEOUT_MS = 10_000;

export class TwitchOAuthError extends Error {
  constructor(readonly code: "invalidGrant" | "failed") {
    super(`twitch oauth: ${code}`);
    this.name = "TwitchOAuthError";
  }
}

export type TwitchCredentials = { clientId: string; clientSecret: string };

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new TwitchOAuthError("failed");
  }
}

export function buildAuthorizationUrl(credentials: TwitchCredentials, input: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    // channel:read:vips lets the bot read the channel's VIP list for the VIP role. Nothing that can change the channel.
    scope: "channel:read:vips",
    state: input.state,
    // Always show the consent screen, so the right account can be picked.
    force_verify: "true",
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.array(z.string()).optional(),
});

export async function exchangeCode(credentials: TwitchCredentials, code: string, redirectUri: string) {
  const response = await send("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (response.status === 400 || response.status === 401) throw new TwitchOAuthError("invalidGrant");
  if (!response.ok) throw new TwitchOAuthError("failed");
  const parsed = tokenResponse.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new TwitchOAuthError("failed");
  return { accessToken: parsed.data.access_token, refreshToken: parsed.data.refresh_token, scopes: parsed.data.scope ?? [] };
}

/** Trades a refresh token for an access token (used only to revoke on disconnect). */
export async function refreshAccessToken(credentials: TwitchCredentials, refreshToken: string): Promise<string> {
  const response = await send("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new TwitchOAuthError(response.status === 400 || response.status === 401 ? "invalidGrant" : "failed");
  const parsed = tokenResponse.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new TwitchOAuthError("failed");
  return parsed.data.access_token;
}

/** Whose token it is. */
export async function validateToken(accessToken: string): Promise<{ userId: string; login: string }> {
  const response = await send("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${accessToken}` } });
  if (!response.ok) throw new TwitchOAuthError("invalidGrant");
  const parsed = z.object({ user_id: z.string().min(1), login: z.string().min(1) }).safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new TwitchOAuthError("failed");
  return { userId: parsed.data.user_id, login: parsed.data.login };
}

/** Best effort: a revoked grant is useless even if the database ever leaked. */
export async function revokeToken(credentials: TwitchCredentials, token: string): Promise<void> {
  try {
    await send("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      body: new URLSearchParams({ client_id: credentials.clientId, token }),
    });
  } catch {
    // A courtesy: the stored login is deleted either way.
  }
}
