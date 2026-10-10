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

/** A channel of the server, as the bot reports it to the dashboard (pickers). */
export const CHANNEL_KINDS = ["text", "voice", "category"] as const;
export const channelKind = z.enum(CHANNEL_KINDS);
export type ChannelKind = z.infer<typeof channelKind>;

export const guildChannel = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  name: z.string(),
  kind: channelKind,
  /** Name of the category it sits in, for grouping in a picker. */
  parent: z.string().nullable(),
});
export type GuildChannel = z.infer<typeof guildChannel>;

/** GET /internal/guild/channels?kinds=text,voice */
export const channelsResponse = z.object({ channels: z.array(guildChannel) });

/** POST /internal/moderation/refresh-case */
export const refreshCaseBody = z.object({ caseNumber: z.number().int().positive() });
export const refreshCaseResponse = z.object({
  status: z.enum(["updated", "no-log-message", "not-found", "failed"]),
});
export type RefreshCaseStatus = z.infer<typeof refreshCaseResponse>["status"];

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
