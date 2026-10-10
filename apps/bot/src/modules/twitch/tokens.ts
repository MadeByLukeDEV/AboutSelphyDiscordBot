import { TWITCH_REFRESH_TOKEN_PURPOSE } from "@aboutselphy/shared";
import { decryptToken, encryptToken } from "@aboutselphy/shared/token-cipher";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { refreshUserToken, TwitchError, type Credentials } from "./helix";
import { markNeedsReconnect, readConnection, storeRefreshToken } from "./repository";

// The user access token the EventSub socket and Helix calls need. The refresh
// token lives encrypted in the database (the dashboard stored it after the
// one-time "Connect Twitch"); access tokens live only in memory.

const REFRESH_TOKEN_PURPOSE = TWITCH_REFRESH_TOKEN_PURPOSE;

/** Refresh this long before the token really expires. */
const EARLY_MS = 120_000;

let cached: { token: string; expiresAt: number } | undefined;
let inFlight: Promise<string> | undefined;

export function twitchCredentials(): Credentials | undefined {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY } = env();
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TOKEN_ENCRYPTION_KEY) return undefined;
  return { clientId: TWITCH_CLIENT_ID, clientSecret: TWITCH_CLIENT_SECRET };
}

/** Why there is no token: not connected at all, or the grant was refused and needs a new login. */
export class NoTwitchToken extends Error {
  constructor(readonly reason: "notConfigured" | "notConnected" | "needsReconnect") {
    super(`no twitch token: ${reason}`);
    this.name = "NoTwitchToken";
  }
}

export function forgetAccessToken(): void {
  cached = undefined;
}

/** A valid access token; refreshes (once at a time) when the cached one is about to expire. */
export function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > EARLY_MS) return Promise.resolve(cached.token);
  inFlight ??= refresh().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

async function refresh(): Promise<string> {
  const credentials = twitchCredentials();
  const key = env().TOKEN_ENCRYPTION_KEY;
  if (!credentials || !key) throw new NoTwitchToken("notConfigured");
  const connection = await readConnection();
  if (!connection) throw new NoTwitchToken("notConnected");
  if (connection.needsReconnect) throw new NoTwitchToken("needsReconnect");

  let refreshToken: string;
  try {
    refreshToken = decryptToken(connection.refreshTokenEnc, REFRESH_TOKEN_PURPOSE, key);
  } catch {
    // Wrong key or a tampered value: nothing to do but ask for a new login.
    log.error({}, "twitch: stored refresh token cannot be decrypted (TOKEN_ENCRYPTION_KEY changed?)");
    await markNeedsReconnect();
    throw new NoTwitchToken("needsReconnect");
  }

  try {
    const fresh = await refreshUserToken(credentials, refreshToken);
    // Always keep the rotated refresh token: the old one is now dead.
    if (fresh.refreshToken) await storeRefreshToken(encryptToken(fresh.refreshToken, REFRESH_TOKEN_PURPOSE, key));
    cached = { token: fresh.accessToken, expiresAt: Date.now() + fresh.expiresInSeconds * 1000 };
    return fresh.accessToken;
  } catch (err) {
    if (err instanceof TwitchError && err.code === "invalidGrant") {
      log.warn({}, "twitch: the refresh token was rejected, the account must be connected again");
      await markNeedsReconnect();
      throw new NoTwitchToken("needsReconnect");
    }
    throw err; // a network hiccup: the caller retries later
  }
}
