import type { LevelSettings } from "@aboutselphy/shared/levels";

// Types shared by the service, the action and the client form. No server-only imports.

export type LevelsError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "roleNotAllowed" | "failed";
export type SaveLevelsResult = { ok: true; settings: LevelSettings; botNotified: boolean } | { ok: false; error: LevelsError };

export type LeaderboardRow = { userId: string; name: string; xp: number; level: number; messages: number; voiceMinutes: number };
