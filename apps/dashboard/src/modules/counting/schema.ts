import type { CountingSettings } from "@aboutselphy/shared/counting";

// Types shared by the service, the actions and the client components. No server-only imports.

export type CountingStats = { currentCount: number; highScore: number; lastUserId: string | null };
export type CountingError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "failed";
export type SaveCountingResult = { ok: true; settings: CountingSettings; botNotified: boolean } | { ok: false; error: CountingError };
export type ResetCountingResult = { ok: true } | { ok: false; error: CountingError };
