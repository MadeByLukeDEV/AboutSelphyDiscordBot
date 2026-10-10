import { z } from "zod";
import { DEFAULT_EMBED_COLOR, DEFAULT_TEMPLATE, MAX_TEMPLATE_LENGTH } from "@aboutselphy/shared/twitch-template";

export { DEFAULT_TEMPLATE, MAX_TEMPLATE_LENGTH };

// Types and validation shared by the actions, the service and the client
// components. No server-only imports here.

export const twitchSettingsSchema = z.object({
  enabled: z.boolean(),
  markEndedOnOffline: z.boolean(),
});
export type TwitchSettings = z.infer<typeof twitchSettingsSchema>;

export type TwitchStreamerView = {
  id: string;
  login: string;
  displayName: string;
  channelId: string;
  pingRoleId: string | null;
  messageTemplate: string;
  embedColor: number;
  showThumbnail: boolean;
  showGame: boolean;
  enabled: boolean;
};

export type TwitchOverview = {
  /** Client ID, secret and encryption key are set: "Connect" can work. */
  ready: boolean;
  connection: { login: string; needsReconnect: boolean; connectedByName: string | null; connectedAt: string } | null;
  settings: TwitchSettings;
  streamers: TwitchStreamerView[];
};

/** The add/edit form. `id` is set when editing; `login` is only used when adding. */
export const streamerSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  login: z.string().trim().regex(/^@?[a-zA-Z0-9_]{3,25}$/).optional(),
  channelId: z.string().regex(/^\d{17,20}$/),
  /** "" = nobody is pinged. */
  pingRoleId: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/)]),
  messageTemplate: z.string().trim().min(1).max(MAX_TEMPLATE_LENGTH),
  embedColor: z.number().int().min(0).max(0xffffff),
  showThumbnail: z.boolean(),
  showGame: z.boolean(),
  enabled: z.boolean(),
});
export type StreamerInput = z.infer<typeof streamerSchema>;

/** What the form validates before it sends anything (the server validates again). */
export const streamerFormSchema = z.object({
  login: z.string().trim().regex(/^@?[a-zA-Z0-9_]{3,25}$/),
  channelId: z.string().regex(/^\d{17,20}$/),
  pingRoleId: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/)]),
  messageTemplate: z.string().trim().min(1).max(MAX_TEMPLATE_LENGTH),
  embedColor: z.number().int().min(0).max(0xffffff),
  showThumbnail: z.boolean(),
  showGame: z.boolean(),
  enabled: z.boolean(),
});

export type StreamerFormValues = {
  login: string;
  channelId: string;
  pingRoleId: string;
  messageTemplate: string;
  embedColor: number;
  showThumbnail: boolean;
  showGame: boolean;
  enabled: boolean;
};

export const DEFAULT_STREAMER_FORM: StreamerFormValues = {
  login: "",
  channelId: "",
  pingRoleId: "",
  messageTemplate: DEFAULT_TEMPLATE,
  embedColor: DEFAULT_EMBED_COLOR,
  showThumbnail: true,
  showGame: true,
  enabled: true,
};

export type TwitchError =
  | "forbidden"
  | "invalid"
  | "notConnected"
  | "notFound"
  | "botUnavailable"
  | "twitchNotFound"
  | "channelNotFound"
  | "roleNotFound"
  | "tooManyStreamers"
  | "alreadyAdded"
  | "failed";

export type SaveStreamerResult =
  | { ok: true; streamer: TwitchStreamerView; botNotified: boolean }
  | { ok: false; error: TwitchError };

export type SaveTwitchResult =
  | { ok: true; settings: TwitchSettings; botNotified: boolean }
  | { ok: false; error: TwitchError };

export type SimpleResult = { ok: true; botNotified: boolean } | { ok: false; error: TwitchError };

/** What the callback route reports back to the page (a code in the query string, never Twitch's own text). */
export const CONNECT_OUTCOMES = [
  "connected",
  "cancelled",
  "invalidState",
  "noRefreshToken",
  "notConfigured",
  "forbidden",
  "failed",
] as const;
export type ConnectOutcome = (typeof CONNECT_OUTCOMES)[number];
export const isConnectOutcome = (v: unknown): v is ConnectOutcome => CONNECT_OUTCOMES.includes(v as ConnectOutcome);
