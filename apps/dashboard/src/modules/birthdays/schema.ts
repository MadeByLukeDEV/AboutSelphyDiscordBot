import type { BirthdaySettings } from "@aboutselphy/shared/birthdays";

// Types shared by the service, the actions and the client components. No server-only imports.

export type BirthdayError = "forbidden" | "invalid" | "needsTarget" | "memberNotFound" | "notFound" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "failed";
export type SaveBirthdayResult = { ok: true; settings: BirthdaySettings; botNotified: boolean } | { ok: false; error: BirthdayError };

export type BirthdayRow = {
  userId: string;
  name: string;
  month: number;
  day: number;
  /** Whole days until the next celebration (0 = today). */
  inDays: number;
};

export type SimpleBirthdayResult = { ok: true } | { ok: false; error: BirthdayError };
