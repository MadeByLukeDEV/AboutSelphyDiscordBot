import { z } from "zod";

// The counting channel's settings. One definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/counting" in client components.

export const countingSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** "" = none. */
    channelId: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/)]),
    allowConsecutive: z.boolean(),
    resetOnMistake: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.enabled && !v.channelId) ctx.addIssue({ code: "custom", path: ["channelId"], message: "needsChannel" });
  });
export type CountingSettings = z.infer<typeof countingSettingsSchema>;
