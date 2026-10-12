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

/** POST /internal/twitchvip/unlink: take the role off and forget the link (before the dashboard removes it). */
export const twitchVipUnlinkBody = z.object({ id: z.string().min(1).max(64) });
export const twitchVipUnlinkStatus = z.enum(["done", "failed"]);
export type TwitchVipUnlinkStatus = z.infer<typeof twitchVipUnlinkStatus>;
