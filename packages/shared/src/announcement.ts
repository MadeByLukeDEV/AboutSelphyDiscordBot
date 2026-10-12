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

export const REPEATS = ["none", "daily", "weekly", "monthly"] as const;
export type Repeat = (typeof REPEATS)[number];
export const MAX_TEMPLATES = 30;
export const MAX_TEMPLATE_NAME = 60;

function addMonths(d: Date, k: number): Date {
  const month = d.getUTCMonth() + k;
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(d.getUTCFullYear(), month, Math.min(d.getUTCDate(), lastDay), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
}

/**
 * The first repeat of `prev` that lies after `now`: every day, every 7 days, or the same day of a later month (cut to the
 * month's last day, e.g. the 31st becomes the 28th). If the bot was down for a while, missed rounds are skipped, not sent.
 */
export function nextRun(prev: Date, repeat: Exclude<Repeat, "none">, now: Date): Date {
  for (let k = 1; k < 5000; k++) {
    const candidate = repeat === "monthly" ? addMonths(prev, k) : new Date(prev.getTime() + k * (repeat === "weekly" ? 7 : 1) * 86_400_000);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return new Date(now.getTime() + 86_400_000);
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
    /** Post again every day / week / month (only with mode "schedule"). */
    repeat: z.enum(REPEATS).default("none"),
    /** No further posts after this time (ISO). */
    repeatUntil: z.string().max(40).optional(),
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
      if (v.repeat !== "none" && v.repeatUntil) {
        const until = Date.parse(v.repeatUntil);
        if (Number.isNaN(until)) issue("repeatUntil", "time");
        else if (!Number.isNaN(at) && until <= at) issue("repeatUntil", "past");
      }
    }
    if (v.repeat !== "none" && v.mode !== "schedule") issue("repeat", "needsSchedule");
  });
export type AnnouncementInput = z.infer<typeof announcementInput>;

/** A saved template: the content of an announcement without its timing. Channel and role may be empty. */
export const announcementTemplateInput = z
  .object({
    name: z.string().trim().min(1).max(MAX_TEMPLATE_NAME),
    content: z.string().max(MAX_CONTENT),
    embedEnabled: z.boolean(),
    embedTitle: z.string().max(MAX_EMBED_TITLE),
    embedDescription: z.string().max(MAX_EMBED_DESCRIPTION),
    embedColor: z.number().int().min(0).max(0xffffff),
    embedImageUrl: z.string().max(MAX_IMAGE_URL),
    channelId: z.union([z.literal(""), snowflake]),
    pingRoleId: z.union([z.literal(""), snowflake]),
  })
  .superRefine((v, ctx) => {
    if (!isAllowedImageUrl(v.embedImageUrl)) ctx.addIssue({ code: "custom", path: ["embedImageUrl"], message: "image" });
    const hasText = v.content.trim() !== "";
    const hasEmbed = v.embedEnabled && (v.embedTitle.trim() !== "" || v.embedDescription.trim() !== "");
    if (!hasText && !hasEmbed) ctx.addIssue({ code: "custom", path: ["content"], message: "empty" });
  });
export type AnnouncementTemplateInput = z.infer<typeof announcementTemplateInput>;
