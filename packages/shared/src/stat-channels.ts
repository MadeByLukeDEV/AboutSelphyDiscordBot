import { z } from "zod";

// Stat channels: voice channels whose name shows a live number. One definition for the dashboard
// and the bot. Pure. Import it from "@aboutselphy/shared/stat-channels" in client components.

export const STAT_KINDS = ["members", "humans", "bots", "boosts", "channels", "roles", "voice"] as const;
export type StatKind = (typeof STAT_KINDS)[number];
export const MAX_STAT_CHANNELS = 10;
export const MAX_STAT_TEMPLATE = 90;
export const DEFAULT_STAT_TEMPLATE = "Members: {count}";

/** The channel name for a number: {count} filled in, control characters removed, at most 100 characters (Discord's limit). */
export function renderStatName(template: string, value: number): string {
  const text = template
    .replace(/\{count\}/g, new Intl.NumberFormat("en-US").format(Math.max(0, Math.trunc(value))))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 100);
}

const snowflake = z.string().regex(/^\d{17,20}$/);

export const statChannelInput = z.object({
  id: z.string().min(1).max(64).optional(),
  channelId: snowflake,
  kind: z.enum(STAT_KINDS),
  template: z
    .string()
    .trim()
    .min(1)
    .max(MAX_STAT_TEMPLATE)
    .refine((t) => t.includes("{count}"), "needsCount"),
});
export type StatChannelInput = z.infer<typeof statChannelInput>;
