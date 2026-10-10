import type { ReminderSettings } from "@aboutselphy/shared/reminders";

// Types shared by the service, the actions and the client components. No server-only imports.

export type ReminderError = "forbidden" | "invalid" | "failed";
export type SaveReminderResult = { ok: true; settings: ReminderSettings; botNotified: boolean } | { ok: false; error: ReminderError };
export type ReminderStats = { pending: number; nextAt: string | null };
