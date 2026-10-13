import type { EventRuleInput, EventSettings } from "@aboutselphy/shared/eventcal";

// Types shared by the service, the actions and the client components. No server-only imports.

export type EventError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "tooMany" | "notFound" | "needsSetup" | "failed";
export type SaveEventSettingsResult = { ok: true; settings: EventSettings; botNotified: boolean } | { ok: false; error: EventError };
export type SaveRuleResult = { ok: true; botNotified: boolean } | { ok: false; error: EventError };
export type SimpleEventResult = { ok: true } | { ok: false; error: EventError };
export type CheckEventsResult = { ok: true; status: string; events: number; posted: number; edited: number } | { ok: false; error: EventError };
export type OverviewResult = { ok: true; status: "posted" | "updated" } | { ok: false; error: EventError };

export type EventRuleRow = Required<Pick<EventRuleInput, "id">> & Omit<EventRuleInput, "id">;
export type EventOverview = { settings: EventSettings; hasOverview: boolean; lastCheckedAt: string | null; lastStatus: string | null; baselined: boolean };
