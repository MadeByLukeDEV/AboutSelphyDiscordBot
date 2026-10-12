import { z } from "zod";

// The anti-bot channel (a honeypot): anyone who writes in it is timed out and kicked. One definition for the
// dashboard and the bot. Pure. Import it from "@aboutselphy/shared/antibot" in client components.

/** Discord's own limits for a timeout: 1 minute to 28 days. */
export const MIN_ANTIBOT_TIMEOUT_SECONDS = 60;
export const MAX_ANTIBOT_TIMEOUT_SECONDS = 28 * 86_400;
export const DEFAULT_ANTIBOT_TIMEOUT_SECONDS = 7 * 86_400;

/** Ready-made lengths for the picker (seconds). */
export const ANTIBOT_TIMEOUT_CHOICES = [3_600, 86_400, 604_800, 2_419_200] as const;

export const antiBotSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** Empty until picked; switching on needs it. */
    channelId: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/)]),
    timeoutSeconds: z.number().int().min(MIN_ANTIBOT_TIMEOUT_SECONDS).max(MAX_ANTIBOT_TIMEOUT_SECONDS),
    /** Only log what would have happened (and tell the mod log); nothing is deleted, timed out or kicked. */
    dryRun: z.boolean(),
  })
  .refine((v) => !v.enabled || v.channelId !== "", { path: ["channelId"], message: "channel" });
export type AntiBotSettings = z.infer<typeof antiBotSettingsSchema>;
