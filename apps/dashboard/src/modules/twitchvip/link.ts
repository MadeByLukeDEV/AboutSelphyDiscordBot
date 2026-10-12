import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env, siteUrl } from "@/lib/env";
import { linkTwitchVerifiedViaBot } from "@/modules/bot-api";

// "Link with Discord": a member proves which Twitch account is theirs through the Twitch connection on their own
// Discord profile (Discord verified it with Twitch's own login). They sign in with Discord (scopes identify +
// connections), we read their connections ONCE, keep only the Twitch account id and name, and throw the token
// away. Nothing here needs the member to be staff, so the two routes are public and defend themselves: a state
// cookie, a time limit on every call, short outcome codes (never Discord's own text) and a per-address limit.

export const VIP_LINK_COOKIE = "vip-link-state";
export const VIP_LINK_COOKIE_PATH = "/api/link/twitch";
export const VIP_LINK_COOKIE_MAX_AGE = 600;

export const LINK_OUTCOMES = ["linked", "notConfigured", "denied", "badState", "noTwitch", "notInServer", "notEnabled", "taken", "failed", "tooMany"] as const;
export type LinkOutcome = (typeof LINK_OUTCOMES)[number];
export const isLinkOutcome = (value: unknown): value is LinkOutcome => typeof value === "string" && (LINK_OUTCOMES as readonly string[]).includes(value);

const TIMEOUT_MS = 10_000;
const redirectUri = () => `${siteUrl()}/api/link/twitch/callback`;

function credentials(): { clientId: string; clientSecret: string } | null {
  const { DISCORD_APP_ID, DISCORD_CLIENT_SECRET } = env();
  return DISCORD_APP_ID && DISCORD_CLIENT_SECRET ? { clientId: DISCORD_APP_ID, clientSecret: DISCORD_CLIENT_SECRET } : null;
}

/** Where to send the member, and the state to remember in a cookie. Null when this isn't configured. */
export function startVipLink(): { url: string; state: string } | null {
  const c = credentials();
  if (!c) return null;
  const state = randomBytes(32).toString("hex");
  const params = new URLSearchParams({ client_id: c.clientId, redirect_uri: redirectUri(), response_type: "code", scope: "identify connections", state, prompt: "none" });
  return { url: `https://discord.com/oauth2/authorize?${params}`, state };
}

// A small in-memory limit per address (one dashboard process): the callback calls Discord and the bot.
const hits = new Map<string, number[]>();
export function allowAttempt(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 20) {
    hits.set(key, recent);
    return false;
  }
  hits.set(key, [...recent, now]);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= 10 * 60_000)) hits.delete(k);
  return true;
}

const sameState = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const tokenResponse = z.object({ access_token: z.string().min(1) });
const me = z.object({ id: z.string().regex(/^\d{17,20}$/), username: z.string(), global_name: z.string().nullable().optional() });
const connections = z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), verified: z.boolean() }));

async function discord(path: string, token: string): Promise<unknown> {
  const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`discord ${response.status}`);
  return response.json();
}

/** Finishes the sign-in: reads the member's verified Twitch connection and hands it to the bot. Never throws. */
export async function completeVipLink(input: { params: URLSearchParams; cookie: string | undefined }): Promise<LinkOutcome> {
  const c = credentials();
  if (!c) return "notConfigured";
  if (input.params.get("error")) return "denied";
  const state = input.params.get("state");
  const code = input.params.get("code");
  if (!state || !input.cookie || !sameState(state, input.cookie)) return "badState";
  if (!code || code.length > 512) return "failed";

  let token = "";
  try {
    const exchange = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri() }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!exchange.ok) return "failed";
    const parsed = tokenResponse.safeParse(await exchange.json().catch(() => undefined));
    if (!parsed.success) return "failed";
    token = parsed.data.access_token;

    const who = me.safeParse(await discord("/users/@me", token));
    const list = connections.safeParse(await discord("/users/@me/connections", token));
    if (!who.success || !list.success) return "failed";
    // Only a connection Discord itself verified counts; anything the member merely typed in is ignored.
    const twitch = list.data.find((x) => x.type === "twitch" && x.verified && /^\d{1,20}$/.test(x.id));
    if (!twitch) return "noTwitch";

    const status = await linkTwitchVerifiedViaBot({ discordUserId: who.data.id, discordName: (who.data.global_name || who.data.username).slice(0, 100), twitchUserId: twitch.id, twitchLogin: twitch.name.slice(0, 64) });
    return status ?? "failed";
  } catch (error) {
    console.error("[vip-link] failed", error instanceof Error ? error.message : "unknown");
    return "failed";
  } finally {
    // The token has done its one job: give it back so it can't be used again.
    if (token) {
      void fetch("https://discord.com/api/v10/oauth2/token/revoke", { method: "POST", body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, token, token_type_hint: "access_token" }), signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => undefined);
    }
  }
}
