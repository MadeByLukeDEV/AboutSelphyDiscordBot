import type { EventRuleInput, ReminderDefaults } from "@aboutselphy/shared/eventcal";

// Types shared by the service, the actions and the client components. No server-only imports.

export type EventError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "tooMany" | "notFound" | "needsSetup" | "badRange" | "failed";
export type SaveRuleResult = { ok: true; botNotified: boolean } | { ok: false; error: EventError };
export type SaveSourceResult = { ok: true; botNotified: boolean } | { ok: false; error: EventError };
export type SimpleEventResult = { ok: true } | { ok: false; error: EventError };
export type CheckEventsResult = { ok: true; status: string; events: number; posted: number; edited: number } | { ok: false; error: EventError };
export type OverviewResult = { ok: true; status: "posted" | "updated" } | { ok: false; error: EventError };

export type ImportArticleResult = { ok: true; dated: number; repeating: number; month: string } | { ok: false; error: EventError | "unreadable" | "tooLong" };
export type PostedEventRow = { id: string; title: string; rule: string; startsAt: string };
export type RepostResult = { ok: true } | { ok: false; error: EventError | "gone" };
export type ArticleRow = { id: string; title: string; monthKey: string; events: number; createdAt: string };

/** A stored event as the dashboard shows and edits it. */
export type EventRow = {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  description: string;
  summary: string;
  items: string[];
  imageUrl: string;
  videoUrl: string;
  origin: string;
  locked: boolean;
  removed: boolean;
  /** Overrides the rules' lead times for this event (days before the start). */
  reminderDays: number[];
  /** "Every Tuesday": this entry stands for a whole repeating series of the calendar. */
  recurrence: string | null;
};

/** A source (game) with its settings, status, pasted articles and stored events. */
export type SourceRow = {
  id: string;
  name: string;
  enabled: boolean;
  icsUrl: string;
  pageUrlTemplate: string;
  contentSelector: string;
  fetchMode: string;
  overviewChannelId: string;
  overviewDays: number;
  summaryChannelId: string;
  /** Post the monthly summary by itself when a new month has events. */
  summaryAuto: boolean;
  /** Announcement times per kind of event. */
  reminderDefaults: ReminderDefaults;
  /** The colour of this game's drawn pictures, and whether the monthly summary gets one. */
  accentColor: string;
  summaryImage: boolean;
  hasBackground: boolean;
  items: ItemRow[];
  hasOverview: boolean;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastFetchedAt: string | null;
  lastFetchStatus: string | null;
  /** The bot is reading this source's calendar and pages right now. */
  syncing: boolean;
  articles: ArticleRow[];
  events: EventRow[];
};

/** An item of a game's library: its name, and whether a picture was uploaded for it. */
export type ItemRow = { id: string; name: string; hasImage: boolean };
export type ImageResult = { ok: true } | { ok: false; error: EventError | "noFile" | "type" | "size" | "dimensions" };

export type EventRuleRow = Required<Pick<EventRuleInput, "id">> & Omit<EventRuleInput, "id" | "leadDays">;
