import type { WelcomeSettings } from "@aboutselphy/shared/welcome";

// Types shared by the service, the actions and the client form. No server-only imports.

export type WelcomeError =
  | "forbidden"
  | "invalid"
  | "needsChannel"
  | "needsText"
  | "botUnavailable"
  | "channelNotFound"
  | "roleNotFound"
  | "roleNotAllowed"
  | "failed";

export type SaveWelcomeResult = { ok: true; settings: WelcomeSettings; botNotified: boolean } | { ok: false; error: WelcomeError };

/** What the page knows about the uploaded card picture (never its bytes). */
export type CardImageView = { contentType: string; width: number; height: number; uploadedByName: string; uploadedAt: string };

export type CardImageError = "forbidden" | "noFile" | "type" | "size" | "dimensions" | "failed";
export type CardImageResult = { ok: true; image: CardImageView | null } | { ok: false; error: CardImageError };
