import { z } from "zod";

// What an announcement may contain. One definition for the dashboard (forms and
// Server Actions) and the bot (which re-checks before it posts). Pure and free of
// Node APIs. Import it from "@aboutselphy/shared/announcement" in client components.

export const MAX_CONTENT = 2000;
export const MAX_EMBED_TITLE = 256;
export const MAX_EMBED_DESCRIPTION = 4000;
export const MAX_IMAGE_URL = 500;
/** The brand green #00FFA8. */
export const DEFAULT_ANNOUNCEMENT_COLOR = 0x00ffa8;
/** A scheduled time must be this far ahead, so "later" can't mean "right now". */
export const MIN_SCHEDULE_AHEAD_MS = 60_000;
/** ... and not absurdly far. */
export const MAX_SCHEDULE_AHEAD_MS = 366 * 86_400_000;

const snowflake = z.string().regex(/^\d{17,20}$/);

/** https only, no credentials in the address, no control characters. */
export function isAllowedImageUrl(value: string): boolean {
  if (value === "") return true;
  if (value.length > MAX_IMAGE_URL || /[\u0000-\u001f\u007f\s]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export const ANNOUNCEMENT_MODES = ["draft", "now", "schedule"] as const;
export type AnnouncementMode = (typeof ANNOUNCEMENT_MODES)[number];

/** What the composer sends. `scheduledFor` is an ISO time, only read for mode "schedule". */
export const announcementInput = z
  .object({
    id: z.string().min(1).max(64).optional(),
    content: z.string().max(MAX_CONTENT),
    embedEnabled: z.boolean(),
    embedTitle: z.string().max(MAX_EMBED_TITLE),
    embedDescription: z.string().max(MAX_EMBED_DESCRIPTION),
    embedColor: z.number().int().min(0).max(0xffffff),
    embedImageUrl: z.string().max(MAX_IMAGE_URL),
    channelId: snowflake,
    /** "" = no ping. */
    pingRoleId: z.union([z.literal(""), snowflake]),
    /** Also mention @everyone. Only admins may switch it on or off (checked by the action). */
    pingEveryone: z.boolean().default(false),
    mode: z.enum(ANNOUNCEMENT_MODES),
    scheduledFor: z.string().max(40).optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!isAllowedImageUrl(v.embedImageUrl)) issue("embedImageUrl", "image");
    const hasText = v.content.trim() !== "";
    const hasEmbed = v.embedEnabled && (v.embedTitle.trim() !== "" || v.embedDescription.trim() !== "");
    if (!hasText && !hasEmbed) issue("content", "empty");
    if (v.mode === "schedule") {
      const at = v.scheduledFor ? Date.parse(v.scheduledFor) : Number.NaN;
      if (Number.isNaN(at)) issue("scheduledFor", "time");
      else if (at < Date.now() + MIN_SCHEDULE_AHEAD_MS) issue("scheduledFor", "past");
      else if (at > Date.now() + MAX_SCHEDULE_AHEAD_MS) issue("scheduledFor", "tooFar");
    }
  });
export type AnnouncementInput = z.infer<typeof announcementInput>;
