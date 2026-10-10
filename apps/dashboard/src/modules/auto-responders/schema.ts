import type { MatchType } from "@aboutselphy/shared/auto-responders";

// Types shared by the service, the actions and the client components. No server-only imports.

export type AutoResponderRow = { id: string; trigger: string; matchType: MatchType; response: string; cooldownSeconds: number; channelIds: string[]; enabled: boolean; uses: number };
export type AutoResponderError = "forbidden" | "invalid" | "tooMany" | "notFound" | "botUnavailable" | "channelNotFound" | "failed";
export type SaveAutoResponderResult = { ok: true; botNotified: boolean } | { ok: false; error: AutoResponderError };
