import type { RetentionSettings } from "@aboutselphy/shared/retention";

// Types shared by the service, the actions and the client components. No server-only imports.

export type RetentionError = "forbidden" | "invalid" | "failed";
export type SaveRetentionResult = { ok: true; settings: RetentionSettings; botNotified: boolean } | { ok: false; error: RetentionError };

export type RetentionLastRun = { at: string | null; result: string };

export type EraseMemberResult = { ok: true; summary: string; empty: boolean } | { ok: false; error: "forbidden" | "invalid" | "botUnavailable" | "failed" };
