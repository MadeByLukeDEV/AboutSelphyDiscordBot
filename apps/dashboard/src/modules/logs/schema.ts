import type { LogSettings } from "@aboutselphy/shared/logs";

// Types shared by the service, the action and the client form. No server-only imports.

export type LogsError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "failed";
export type SaveLogsResult = { ok: true; settings: LogSettings; botNotified: boolean } | { ok: false; error: LogsError };
