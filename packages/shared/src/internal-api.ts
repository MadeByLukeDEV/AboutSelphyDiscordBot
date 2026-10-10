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

/** One open temporary voice room, as the bot reports it for the dashboard's live view. */
export const tempVoiceRoom = z.object({
  channelId: z.string().regex(/^\d{17,20}$/),
  name: z.string(),
  ownerId: z.string().regex(/^\d{17,20}$/),
  /** Display name, or null if the owner isn't in the server any more. */
  ownerName: z.string().nullable(),
  memberCount: z.number().int().min(0),
  /** Capped (the first few), the count above is the real number. */
  members: z.array(z.object({ id: z.string(), name: z.string() })).max(25),
  locked: z.boolean(),
  /** 0 = no limit. */
  userLimit: z.number().int().min(0).max(99),
  videoAllowed: z.boolean(),
  soundboardAllowed: z.boolean(),
  allowedCount: z.number().int().min(0),
  blockedCount: z.number().int().min(0),
  /** The lobby it was created from, if known (rooms from before lobbies were tracked have none). */
  lobbyChannelId: z.string().nullable(),
  createdAt: z.string(),
});
export type TempVoiceRoom = z.infer<typeof tempVoiceRoom>;

/** One configured lobby, with its live state. */
export const tempVoiceLobbyStatus = z.object({
  channelId: z.string().regex(/^\d{17,20}$/),
  /** The channel's current name, or null if the channel no longer exists. */
  name: z.string().nullable(),
  enabled: z.boolean(),
  openRooms: z.number().int().min(0),
  /** Permissions the bot still needs where this lobby's rooms are created (empty = all good). */
  missingPermissions: z.array(z.string()),
});
export type TempVoiceLobbyStatus = z.infer<typeof tempVoiceLobbyStatus>;

/** GET /internal/tempvoice/overview */
export const tempVoiceOverview = z.object({
  lobbies: z.array(tempVoiceLobbyStatus),
  rooms: z.array(tempVoiceRoom),
});
export type TempVoiceOverview = z.infer<typeof tempVoiceOverview>;

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
