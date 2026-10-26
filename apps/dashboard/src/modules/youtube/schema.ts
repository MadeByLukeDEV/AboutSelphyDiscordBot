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

/** How many channels can be watched (each costs about 300 free quota units a day). */
export const MAX_YOUTUBE_CHANNELS = 10;

/** A channel address or ID as typed: the "UC..." ID is taken out of it (a youtube.com/channel/UC... link works too). */
export function parseYoutubeChannelId(input: string): string | null {
  return /(?:^|[/=\s])(UC[A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/.exec(input.trim())?.[1] ?? null;
}

export const addYoutubeChannelSchema = z.object({ input: z.string().trim().min(1).max(200) });

export type YoutubeChannelView = { id: string; ytChannelId: string; name: string; enabled: boolean };
export type YoutubeChannelResult = { ok: true; channels: YoutubeChannelView[]; botNotified: boolean } | { ok: false; error: YoutubeError };

export type YoutubeVideoView = { videoId: string; title: string; publishedAt: string; isShort: boolean; announced: boolean };

export type YoutubeOverview = {
  settings: YoutubeSettings;
  /** When the bot last got an answer from YouTube, or null if never. */
  lastCheckedAt: string | null;
  /** A short code when the last poll failed, "" when it worked. */
  lastError: string;
  videos: YoutubeVideoView[];
  channels: YoutubeChannelView[];
};

export type YoutubeError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "invalidChannel" | "tooMany" | "alreadyAdded" | "failed";
export type SaveYoutubeResult = { ok: true; settings: YoutubeSettings; botNotified: boolean } | { ok: false; error: YoutubeError };
