import type { SuggestionSettings, SuggestionStatusName } from "@aboutselphy/shared/suggestions";

// Types shared by the service, the actions and the client components. No server-only imports.

export type SuggestionsError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "notFound" | "wrongState" | "targetNotFound" | "same" | "tooManyNotes" | "failed";
export type SaveSuggestionsResult = { ok: true; settings: SuggestionSettings; botNotified: boolean } | { ok: false; error: SuggestionsError };
export type DecideResult = { ok: true } | { ok: false; error: SuggestionsError };
export type NoteResult = { ok: true; notes: SuggestionNote[] } | { ok: false; error: SuggestionsError };

export type SuggestionNote = { id: string; authorName: string; body: string; createdAt: string };

export type SuggestionRow = {
  id: string;
  number: number;
  authorId: string;
  authorName: string;
  content: string;
  status: SuggestionStatusName;
  up: number;
  down: number;
  decidedByName: string | null;
  decisionReason: string;
  createdAt: string;
  mergedInto: number | null;
  notes: SuggestionNote[];
};
