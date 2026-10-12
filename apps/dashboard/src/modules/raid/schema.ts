import type { RaidSettings } from "@aboutselphy/shared/entry";

// Types shared by the service, the actions and the client components. No server-only imports.

export type RaidError = "forbidden" | "invalid" | "failed";
export type SaveRaidResult = { ok: true; settings: RaidSettings; botNotified: boolean } | { ok: false; error: RaidError };

export type RaidState = { activeUntil: string | null; lastRaidAt: string | null };
