"use server";

import { decisionInput, mergeInput, noteInput, suggestionSettingsSchema } from "@aboutselphy/shared/suggestions";
import { z } from "zod";
import { AuthorizationError, requireAdmin, requireStaff } from "@/modules/auth";
import type { DecideResult, NoteResult, SaveSuggestionsResult } from "./schema";
import { addSuggestionNote, decide, mergeSuggestion, removeSuggestionNote, saveSuggestions } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (settings are admin-only, decisions are for any staff member), validates its input, and returns codes.

async function saveSuggestionSettingsActionRun(input: unknown): Promise<SaveSuggestionsResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = suggestionSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsChannel") ? "needsChannel" : "invalid" };
  return saveSuggestions(parsed.data);
}

async function decideSuggestionActionRun(input: unknown): Promise<DecideResult> {
  let session;
  try {
    session = await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = decisionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return decide(parsed.data, session.user.name);
}

export async function saveSuggestionSettingsAction(...args: Parameters<typeof saveSuggestionSettingsActionRun>): ReturnType<typeof saveSuggestionSettingsActionRun> {
  return audited("suggestions.saveSuggestionSettings", saveSuggestionSettingsActionRun, args);
}

export async function decideSuggestionAction(...args: Parameters<typeof decideSuggestionActionRun>): ReturnType<typeof decideSuggestionActionRun> {
  return audited("suggestions.decideSuggestion", decideSuggestionActionRun, args);
}

// Notes and merges are for any staff member; the name comes from the session, never from the client.
async function staffName(): Promise<{ ok: true; name: string } | { ok: false }> {
  try {
    return { ok: true, name: (await requireStaff()).user.name };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false };
    throw error;
  }
}

async function addSuggestionNoteActionRun(input: unknown): Promise<NoteResult> {
  const who = await staffName();
  if (!who.ok) return { ok: false, error: "forbidden" };
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return addSuggestionNote(parsed.data.suggestionId, parsed.data.body, who.name);
}

async function removeSuggestionNoteActionRun(input: unknown): Promise<NoteResult> {
  const who = await staffName();
  if (!who.ok) return { ok: false, error: "forbidden" };
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeSuggestionNote(parsed.data.id);
}

async function mergeSuggestionActionRun(input: unknown): Promise<DecideResult> {
  const who = await staffName();
  if (!who.ok) return { ok: false, error: "forbidden" };
  const parsed = mergeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return mergeSuggestion(parsed.data.id, parsed.data.targetNumber, who.name);
}

export async function addSuggestionNoteAction(...args: Parameters<typeof addSuggestionNoteActionRun>): ReturnType<typeof addSuggestionNoteActionRun> {
  return audited("suggestions.addSuggestionNote", addSuggestionNoteActionRun, args);
}

export async function removeSuggestionNoteAction(...args: Parameters<typeof removeSuggestionNoteActionRun>): ReturnType<typeof removeSuggestionNoteActionRun> {
  return audited("suggestions.removeSuggestionNote", removeSuggestionNoteActionRun, args);
}

export async function mergeSuggestionAction(...args: Parameters<typeof mergeSuggestionActionRun>): ReturnType<typeof mergeSuggestionActionRun> {
  return audited("suggestions.mergeSuggestion", mergeSuggestionActionRun, args);
}
