import type { StarboardSettings } from "@aboutselphy/shared/starboard";

// Types shared by the service, the actions and the client components. No server-only imports.

export type StarboardError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "failed";
export type SaveStarboardResult = { ok: true; settings: StarboardSettings; botNotified: boolean } | { ok: false; error: StarboardError };

export type StarboardRow = {
  messageId: string;
  channelId: string;
  authorName: string;
  excerpt: string;
  jumpUrl: string;
  stars: number;
  onBoard: boolean;
  createdAt: string;
};
