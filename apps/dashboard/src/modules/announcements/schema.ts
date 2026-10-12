import type { AnnouncementStatus } from "@aboutselphy/db";

// Types shared by the service, the actions and the client components. No server-only imports.

export type AnnouncementView = {
  id: string;
  status: AnnouncementStatus;
  content: string;
  embedEnabled: boolean;
  embedTitle: string;
  embedDescription: string;
  embedColor: number;
  embedImageUrl: string;
  channelId: string;
  pingRoleId: string;
  pingEveryone: boolean;
  /** ISO time, or null for a draft. */
  scheduledFor: string | null;
  /** "none" | "daily" | "weekly" | "monthly" */
  repeat: string;
  repeatUntil: string | null;
  sentAt: string | null;
  lastError: string;
  createdByName: string;
  createdAt: string;
};

export type AnnouncementError =
  | "forbidden"
  | "invalid"
  | "notFound"
  | "botUnavailable"
  | "channelNotFound"
  | "roleNotFound"
  | "locked"
  | "channelFixed"
  | "tooManyTemplates"
  | "failed";

export type SaveAnnouncementResult =
  | { ok: true; announcement: AnnouncementView; botNotified: boolean; discordUpdated: boolean | null }
  | { ok: false; error: AnnouncementError };

export type DeleteAnnouncementResult = { ok: true } | { ok: false; error: AnnouncementError };

export type TemplateView = {
  id: string;
  name: string;
  content: string;
  embedEnabled: boolean;
  embedTitle: string;
  embedDescription: string;
  embedColor: number;
  embedImageUrl: string;
  /** "" = none. */
  channelId: string;
  pingRoleId: string;
};

export type TemplateResult = { ok: true } | { ok: false; error: AnnouncementError };
