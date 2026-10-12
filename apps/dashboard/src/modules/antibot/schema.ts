import type { AntiBotSettings } from "@aboutselphy/shared/antibot";

// Types shared by the service, the actions and the client components. No server-only imports.

export type AntiBotError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "failed";
export type SaveAntiBotResult = { ok: true; settings: AntiBotSettings; botNotified: boolean } | { ok: false; error: AntiBotError };

export type AntiBotStats = { hits: number; lastHitAt: string | null };
