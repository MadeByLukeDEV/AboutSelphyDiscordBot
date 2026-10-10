import { z } from "zod";

// Starboard settings. One definition for the dashboard (form, Server Action) and the bot. Pure and
// free of Node APIs. Import it from "@aboutselphy/shared/starboard" in client components.

export const MIN_THRESHOLD = 1;
export const MAX_THRESHOLD = 25;
export const DEFAULT_EMOJI = "\u2B50";

/** Variation selectors differ between keyboards and Discord; compare without them. */
export const normalizeEmoji = (emoji: string): string => emoji.replace(/\uFE0F/g, "").trim();

/** Exactly one emoji (a single grapheme that contains a pictograph), so the stored value is safe to compare and print. */
export function isSingleEmoji(value: string): boolean {
  const v = value.trim();
  if (v.length === 0 || v.length > 16 || !/\p{Extended_Pictographic}/u.test(v)) return false;
  const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(v)];
  return segments.length === 1;
}

const snowflake = z.string().regex(/^\d{17,20}$/);

export const starboardSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** "" = none. */
    channelId: z.union([z.literal(""), snowflake]),
    emoji: z.string().max(16).refine(isSingleEmoji, "emoji"),
    threshold: z.number().int().min(MIN_THRESHOLD).max(MAX_THRESHOLD),
    allowSelf: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.enabled && !v.channelId) ctx.addIssue({ code: "custom", path: ["channelId"], message: "needsChannel" });
  });
export type StarboardSettings = z.infer<typeof starboardSettingsSchema>;
