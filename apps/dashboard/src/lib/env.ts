import "server-only";
import { z } from "zod";

// Validated once, lazily (`next build` has no runtime env in Docker). Errors
// name the variables and never echo their values. Defaults are the production
// values, so Dokploy only needs what has no safe default. Read server env
// through env(), never process.env.
const schema = z.object({
  // The bot's database (role aboutselphy_bot, schema DATABASE_SCHEMA). Read by
  // @aboutselphy/db itself; validated here so a missing value fails with a
  // clear message and, in Docker, `migrate deploy` has what it needs.
  DATABASE_URL: z.string().min(1),
  DATABASE_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, "must be a plain identifier")
    .default("bot"),
  AUTH_URL: z.url().default("https://auth.aboutselphy.com"),
  AUTH_DATABASE_URL: z.string().min(1),
  AUTH_DATABASE_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, "must be a plain identifier")
    .default("auth"),
  AUTH_COOKIE_PREFIX: z.string().min(1).default("better-auth"),
  // Same value as the auth service's BETTER_AUTH_SECRET (verifies the cookie).
  BETTER_AUTH_SECRET: z.string().min(16),
  BOT_API_URL: z.url().default("http://bot:3100"),
  BOT_API_SECRET: z.string().min(32),
  // Who runs the bot, for the public terms and privacy policy (/terms, /privacy). Not secret. A value that
  // isn't set shows as a visible placeholder on those pages instead of an invented one.
  LEGAL_OPERATOR_NAME: z.string().max(200).optional(),
  LEGAL_OPERATOR_ADDRESS: z.string().max(400).optional(),
  LEGAL_CONTACT_EMAIL: z.string().max(200).optional(),
  LEGAL_COUNTRY: z.string().max(100).optional(),
  LEGAL_HOSTING: z.string().max(300).optional(),
  // Twitch (went live): the dashboard only runs the one-time "Connect Twitch"
  // login and stores the refresh token encrypted; the bot does the rest.
  TWITCH_CLIENT_ID: z.string().min(1).optional(),
  TWITCH_CLIENT_SECRET: z.string().min(1).optional(),
  // 32 bytes as 64 hex characters (same value as the bot's).
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * The public URL of this dashboard. NEXT_PUBLIC_SITE_URL is baked in at build
 * time (the Dockerfile carries the build arg into the runtime stage). Used for
 * return URLs: behind Traefik request.url is the container's internal address.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bot.aboutselphy.com").replace(/\/+$/, "");
}
