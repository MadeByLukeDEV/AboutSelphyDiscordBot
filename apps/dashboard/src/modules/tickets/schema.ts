import type { TicketSettings } from "@aboutselphy/shared/tickets";

// Types shared by the service, the actions and the client components. No server-only imports.

export type TicketsError =
  | "forbidden"
  | "invalid"
  | "needsPanelChannel"
  | "needsCategory"
  | "needsStaff"
  | "botUnavailable"
  | "channelNotFound"
  | "categoryNotFound"
  | "roleNotFound"
  | "failed";

export type SaveTicketsResult = { ok: true; settings: TicketSettings; botNotified: boolean } | { ok: false; error: TicketsError };

export type PanelResult = { ok: true; status: "posted" | "updated" } | { ok: false; error: "forbidden" | "botUnavailable" | "needsSetup" | "channel" | "failed" };

export type TicketRow = {
  id: string;
  number: number;
  status: "open" | "closed";
  openerId: string;
  openerName: string;
  claimedByName: string | null;
  createdAt: string;
  closedAt: string | null;
  closedByName: string | null;
  messageCount: number;
  hasTranscript: boolean;
};
