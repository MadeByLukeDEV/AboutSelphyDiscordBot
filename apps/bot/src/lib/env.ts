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

const schema = z.object({
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
  BOT_ENV: z.enum(["local", "production"]).default("local"),
  BOT_INTEGRATIONS_IN_DEV: bool,
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Lazy and validated once. Errors name the variables, never echo values (the
 * token must not end up in logs).
 */
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

/** Side-effecting jobs (Twitch, YouTube, scheduled posts) only run in production unless forced. */
export function integrationsActive(): boolean {
  const e = env();
  return e.BOT_ENV === "production" || e.BOT_INTEGRATIONS_IN_DEV;
}
