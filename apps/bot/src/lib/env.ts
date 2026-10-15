import { config } from "dotenv";
import { z } from "zod";
import { snowflake } from "@aboutselphy/shared";

// Repo-root env files first (shared with the dashboard), then local overrides.
config({ path: [".env.local", ".env", "../../.env.local", "../../.env"], quiet: true });

const idList = z
  .string()
  .default("")
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(snowflake));

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

// An empty value in .env (KEY="") means "not set", not "invalid".
const optional = <T extends z.ZodType>(type: T) => z.preprocess((v) => (v === "" ? undefined : v), type.optional());

export const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(50),
  DISCORD_APP_ID: snowflake,
  DISCORD_GUILD_ID: snowflake,
  DISCORD_ADMIN_ROLE_IDS: idList,
  DISCORD_MODERATOR_ROLE_IDS: idList,
  DATABASE_URL: z.string().min(1),
  DATABASE_SCHEMA: z.string().default("bot"),
  BOT_API_SECRET: z.string().min(32),
  BOT_API_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  // Optional. Default: loopback locally, all interfaces when BOT_ENV=production.
  BOT_API_HOST: z.string().optional(),
  // Twitch (went live). All optional: without them the module stays off.
  // The dashboard's public address, so /vip link can hand members the "Link with Discord" button. Optional.
  DASHBOARD_URL: optional(z.url()),
  TWITCH_CLIENT_ID: optional(z.string().min(1)),
  TWITCH_CLIENT_SECRET: optional(z.string().min(1)),
  // 32 bytes as 64 hex characters; decrypts the stored Twitch refresh token.
  TOKEN_ENCRYPTION_KEY: optional(z.string().regex(/^[0-9a-fA-F]{64}$/)),
  // YouTube (new uploads). Optional: without them the module stays off.
  YOUTUBE_API_KEY: optional(z.string().min(10)),
  // The channel's ID (starts with UC), not its @handle.
  YOUTUBE_CHANNEL_ID: optional(z.string().regex(/^UC[A-Za-z0-9_-]{22}$/)),
  // true once the "Message Content" privileged intent is enabled in the Developer Portal (Bot ->
  // Privileged Gateway Intents). Needed to read message text, e.g. for ticket transcripts.
  DISCORD_MESSAGE_CONTENT: bool,
  // Optional AI summaries for the event calendar: any OpenAI-compatible chat API (for example Groq or Gemini's compatibility endpoint).
  AI_API_KEY: optional(z.string().min(1)),
  AI_BASE_URL: optional(z.url().refine((u) => u.startsWith("https://"), "must be https")),
  AI_MODEL: optional(z.string().min(1)),
  // A second model on the same provider and key, tried when the main one is overloaded or rate-limited. Optional.
  AI_FALLBACK_MODEL: optional(z.string().min(1)),
  // Thinking models (Gemini 3) spend output tokens on reasoning: "low" or "minimal" keeps that small. Leave empty for providers that don't know the field.
  AI_REASONING_EFFORT: optional(z.enum(["none", "minimal", "low", "medium", "high"])),
  // Max AI calls per day for the event pages (one per changed page, so this is only a safety net).
  AI_MAX_CALLS_PER_DAY: optional(z.coerce.number().int().min(1).max(1000)),
  // An optional Crawl4AI service (headless browser) used for pages a plain request can't get. Internal address, e.g. http://crawl4ai:11235.
  CRAWL4AI_URL: optional(z.url()),
  CRAWL4AI_TOKEN: optional(z.string().min(1)),
  // Hosts the feed announcer may reach even though they are on the internal network, comma separated
  // (a feed bridge such as RSSHub, e.g. "rsshub"). Everything else must be a public https host.
  RSS_INTERNAL_HOSTS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  BOT_ENV: z.enum(["local", "production"]).default("local"),
  BOT_INTEGRATIONS_IN_DEV: bool,
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Lazy and validated once. Errors name the variables, never echo values (the
 * token must not end up in logs).
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Side-effecting jobs (Twitch, YouTube, scheduled posts) only run in production unless forced. */
export function integrationsActive(): boolean {
  const e = env();
  return e.BOT_ENV === "production" || e.BOT_INTEGRATIONS_IN_DEV;
}
