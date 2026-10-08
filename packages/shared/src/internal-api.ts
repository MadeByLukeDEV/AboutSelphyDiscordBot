import { z } from "zod";

/** Modules whose config the bot caches; the dashboard asks it to reload one. */
export const RELOADABLE_MODULES = [
  "moderation",
  "antibot",
  "twitch",
  "tempvoice",
  "announcements",
  "youtube",
  "webhooks",
] as const;
export const reloadModule = z.enum(RELOADABLE_MODULES);
export type ReloadModule = z.infer<typeof reloadModule>;

/** Response of the bot's GET /health. */
export const botHealth = z.object({
  ok: z.boolean(),
  gatewayReady: z.boolean(),
  pingMs: z.number().nullable(),
  uptimeSeconds: z.number(),
  database: z.boolean(),
  guildId: z.string(),
  version: z.string(),
});
export type BotHealth = z.infer<typeof botHealth>;
