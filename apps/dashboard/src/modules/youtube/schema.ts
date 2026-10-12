import { z } from "zod";

// Types and validation shared by the service, the action and the client form. No server-only imports.

export const MAX_TEMPLATE_LENGTH = 300;
export const DEFAULT_TEMPLATE = "New video: {title}";
export const DEFAULT_PREMIERE_TEMPLATE = "Premiere {time}: {title}";
/** YouTube red. */
export const DEFAULT_COLOR = 0xff0000;

const snowflake = z.string().regex(/^\d{17,20}$/);

export const youtubeSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** "" = not chosen yet. */
    channelId: z.union([z.literal(""), snowflake]),
    /** "" = no ping. */
    pingRoleId: z.union([z.literal(""), snowflake]),
    messageTemplate: z.string().trim().min(1).max(MAX_TEMPLATE_LENGTH),
    announceShorts: z.boolean(),
    /** A "Watch" link button under the announcement. */
    showWatchButton: z.boolean(),
    /** Announce scheduled premieres ahead of time. */
    announcePremieres: z.boolean(),
    premiereTemplate: z.string().trim().min(1).max(MAX_TEMPLATE_LENGTH),
    embedColor: z.number().int().min(0).max(0xffffff),
  })
  .superRefine((v, ctx) => {
    if (v.enabled && !v.channelId) ctx.addIssue({ code: "custom", path: ["channelId"], message: "needsChannel" });
  });
export type YoutubeSettings = z.infer<typeof youtubeSettingsSchema>;

export type YoutubeVideoView = { videoId: string; title: string; publishedAt: string; isShort: boolean; announced: boolean };

export type YoutubeOverview = {
  settings: YoutubeSettings;
  /** When the bot last got an answer from YouTube, or null if never. */
  lastCheckedAt: string | null;
  /** A short code when the last poll failed, "" when it worked. */
  lastError: string;
  videos: YoutubeVideoView[];
};

export type YoutubeError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "failed";
export type SaveYoutubeResult = { ok: true; settings: YoutubeSettings; botNotified: boolean } | { ok: false; error: YoutubeError };
