import type { ScreeningSettings } from "@aboutselphy/shared/screening";

// Types shared by the service, the actions and the client components. No server-only imports.

export type ScreeningError = "forbidden" | "invalid" | "needsChannel" | "needsRole" | "sameRole" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "roleNotUsable" | "failed";
export type SaveScreeningResult = { ok: true; settings: ScreeningSettings; botNotified: boolean } | { ok: false; error: ScreeningError };

export type ScreeningEntryStatus = "pending" | "approved" | "rejected" | "left";
export type ScreeningRow = {
  id: string;
  userId: string;
  userName: string;
  accountCreatedAt: string;
  joinedAt: string;
  status: ScreeningEntryStatus;
  decidedByName: string | null;
  decidedAt: string | null;
};

export type DecideScreeningError = "forbidden" | "invalid" | "notFound" | "alreadyDecided" | "botUnavailable" | "failed";
export type DecideScreeningResult = { ok: true } | { ok: false; error: DecideScreeningError };
