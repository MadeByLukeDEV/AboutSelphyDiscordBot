import { z } from "zod";

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
  enabled: boolean;
};

export type TwitchOverview = {
  /** Client ID, secret and encryption key are set: "Connect" can work. */
  ready: boolean;
  connection: { login: string; needsReconnect: boolean; connectedByName: string | null; connectedAt: string } | null;
  settings: TwitchSettings;
  streamers: TwitchStreamerView[];
};

export type TwitchError = "forbidden" | "invalid" | "notConnected" | "notFound" | "failed";

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
