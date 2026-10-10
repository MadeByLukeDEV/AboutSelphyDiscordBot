import { z } from "zod";

/** Modules whose config the bot caches; the dashboard asks it to reload one. */
export const RELOADABLE_MODULES = [
  "moderation",
  "antibot",
  "twitch",
  "tempvoice",
  "announcements",
  "youtube",
  "welcome",
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

/** A role of the server, for a "ping this role" picker. @everyone and managed (bot/integration) roles are left out. */
export const guildRole = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  name: z.string(),
  /** 0 = no colour. */
  color: z.number().int().min(0),
  /**
   * The bot may hand this role out: it sits below the bot's own role, isn't managed by an
   * integration, and carries no powerful permission (admin, kick, ban, manage ...).
   */
  assignable: z.boolean().default(true),
});
export type GuildRole = z.infer<typeof guildRole>;

/** GET /internal/guild/roles */
export const rolesResponse = z.object({ roles: z.array(guildRole) });

/** POST /internal/twitch/resolve: look a Twitch channel up by its login name. */
export const twitchResolveBody = z.object({ login: z.string().regex(/^[a-zA-Z0-9_]{3,25}$/) });
export const twitchResolveResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("found"),
    channel: z.object({ id: z.string().regex(/^\d{1,32}$/), login: z.string(), displayName: z.string() }),
  }),
  z.object({ status: z.literal("notFound") }),
  /** Twitch isn't connected or didn't answer. */
  z.object({ status: z.literal("unavailable") }),
]);
export type TwitchResolveResponse = z.infer<typeof twitchResolveResponse>;

/** POST /internal/announcements/{edit,delete}: which announcement to change on Discord. */
export const announcementIdBody = z.object({ id: z.string().min(1).max(64) });
export const announcementEditStatus = z.enum(["edited", "not-sent", "message-gone", "failed"]);
export const announcementDeleteStatus = z.enum(["deleted", "not-sent", "already-gone", "failed"]);
export type AnnouncementEditStatus = z.infer<typeof announcementEditStatus>;
export type AnnouncementDeleteStatus = z.infer<typeof announcementDeleteStatus>;

/** POST /internal/roles/create: a cosmetic role (no permissions), made by the bot. */
export const roleCreateBody = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.number().int().min(0).max(0xffffff),
  hoist: z.boolean(),
  mentionable: z.boolean(),
});
export const roleCreateResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("created"), role: guildRole }),
  /** The bot lacks the Manage Roles permission. */
  z.object({ status: z.literal("forbidden") }),
  /** Discord's limit of 250 roles is reached. */
  z.object({ status: z.literal("tooMany") }),
  z.object({ status: z.literal("failed") }),
]);
export type RoleCreateResponse = z.infer<typeof roleCreateResponse>;

/** POST /internal/rolepanels/{publish,delete} */
export const rolePanelIdBody = z.object({ id: z.string().min(1).max(64) });
export const rolePanelPublishStatus = z.enum(["published", "updated", "channel", "roles", "emoji", "not-found", "failed"]);
export const rolePanelDeleteStatus = z.enum(["deleted", "already-gone", "not-found", "failed"]);
export type RolePanelPublishStatus = z.infer<typeof rolePanelPublishStatus>;
export type RolePanelDeleteStatus = z.infer<typeof rolePanelDeleteStatus>;

/** A custom emote of the server, for the emoji picker. */
export const guildEmoji = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  name: z.string(),
  animated: z.boolean(),
  /** The text form to store: "<:name:id>" or "<a:name:id>". */
  value: z.string(),
});
export type GuildEmoji = z.infer<typeof guildEmoji>;

/** GET /internal/guild/emojis */
export const emojisResponse = z.object({ emojis: z.array(guildEmoji) });

/** POST /internal/welcome/preview: the welcome card as it would look for a sample member, from the SAVED settings. */
export const welcomePreviewResponse = z.object({ png: z.string().min(1) /* base64 */ });
