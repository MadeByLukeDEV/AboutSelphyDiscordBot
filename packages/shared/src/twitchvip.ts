import { z } from "zod";

// The Twitch VIP role: members who are VIP on the connected channel get a Discord role. One definition for
// the dashboard and the bot. Pure. Import it from "@aboutselphy/shared/twitchvip" in client components.

/** Result of the last sync, shown on the dashboard. */
export const VIP_STATUSES = ["unknown", "ok", "missingScope", "notConnected", "needsReconnect", "unavailable"] as const;
export type VipStatus = (typeof VIP_STATUSES)[number];

/** A Twitch login: 3-25 letters, digits and underscores. */
export const TWITCH_LOGIN_PATTERN = /^[a-zA-Z0-9_]{3,25}$/;

export const MAX_VIP_LINKS = 500;

export const vipSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** Empty until picked; switching on needs it. */
    roleId: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/)]),
  })
  .refine((v) => !v.enabled || v.roleId !== "", { path: ["roleId"], message: "role" });
export type VipSettings = z.infer<typeof vipSettingsSchema>;

/**
 * POST /internal/twitchvip/linked: the dashboard says "this Discord member has this Twitch account connected, and Discord
 * verified it". The bot decides (is the member in the server, is it switched on, is the account free) and answers.
 */
export const twitchVipLinkedBody = z.object({
  discordUserId: z.string().regex(/^\d{17,20}$/),
  discordName: z.string().min(1).max(100),
  twitchUserId: z.string().regex(/^\d{1,20}$/),
  twitchLogin: z.string().min(1).max(64),
});
export const twitchVipLinkedStatus = z.enum(["linked", "notInServer", "notEnabled", "taken", "failed"]);
export type TwitchVipLinkedStatus = z.infer<typeof twitchVipLinkedStatus>;

/** POST /internal/twitchvip/unlink: take the role off and forget the link (before the dashboard removes it). */
export const twitchVipUnlinkBody = z.object({ id: z.string().min(1).max(64) });
export const twitchVipUnlinkStatus = z.enum(["done", "failed"]);
export type TwitchVipUnlinkStatus = z.infer<typeof twitchVipUnlinkStatus>;
