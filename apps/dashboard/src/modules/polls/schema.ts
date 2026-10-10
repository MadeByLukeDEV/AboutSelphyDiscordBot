import type { PollStatus } from "@aboutselphy/db";

// Types shared by the service, the actions and the client components. No server-only imports.

export type PollView = {
  id: string;
  status: PollStatus;
  channelId: string;
  question: string;
  options: string[];
  multiple: boolean;
  endsAt: string | null;
  createdByName: string;
  /** Votes per option, same order as `options`. */
  counts: number[];
  voters: number;
};

export type PollError = "forbidden" | "invalid" | "notFound" | "wrongState" | "botUnavailable" | "channelNotFound" | "failed";

/** `startError`: the poll was saved but could not be posted (it stays a draft). */
export type SavePollResult = { ok: true; started: boolean; startError: PollError | null } | { ok: false; error: PollError };
export type PollActionResult = { ok: true } | { ok: false; error: PollError };
