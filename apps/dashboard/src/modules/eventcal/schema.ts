import type { EventRuleInput, EventSettings } from "@aboutselphy/shared/eventcal";

// Types shared by the service, the actions and the client components. No server-only imports.

export type EventError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "tooMany" | "notFound" | "needsSetup" | "failed";
export type SaveEventSettingsResult = { ok: true; settings: EventSettings; botNotified: boolean } | { ok: false; error: EventError };
export type SaveRuleResult = { ok: true; botNotified: boolean } | { ok: false; error: EventError };
export type SimpleEventResult = { ok: true } | { ok: false; error: EventError };
export type CheckEventsResult = { ok: true; status: string; events: number; posted: number; edited: number } | { ok: false; error: EventError };
export type OverviewResult = { ok: true; status: "posted" | "updated" } | { ok: false; error: EventError };

export type ImportArticleResult = { ok: true; dated: number; repeating: number; month: string } | { ok: false; error: EventError | "unreadable" | "tooLong" };
export type PostedEventRow = { id: string; title: string; rule: string; startsAt: string };
export type RepostResult = { ok: true } | { ok: false; error: EventError | "gone" };
export type ArticleRow = { id: string; title: string; monthKey: string; events: number; createdAt: string };

export type EventRuleRow = Required<Pick<EventRuleInput, "id">> & Omit<EventRuleInput, "id">;
/** An article-only source (one game) with its pasted articles. */
export type SourceRow = { id: string; name: string; enabled: boolean; overviewChannelId: string; overviewDays: number; summaryChannelId: string; hasOverview: boolean; lastCheckedAt: string | null; lastStatus: string | null; articles: ArticleRow[] };
export type SaveSourceResult = { ok: true; botNotified: boolean } | { ok: false; error: EventError };
export type EventOverview = { settings: EventSettings; hasOverview: boolean; lastCheckedAt: string | null; lastStatus: string | null; baselined: boolean };
