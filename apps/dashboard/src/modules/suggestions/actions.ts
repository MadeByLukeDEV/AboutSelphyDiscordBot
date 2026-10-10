"use server";

import { decisionInput, suggestionSettingsSchema } from "@aboutselphy/shared/suggestions";
import { AuthorizationError, requireAdmin, requireStaff } from "@/modules/auth";
import type { DecideResult, SaveSuggestionsResult } from "./schema";
import { decide, saveSuggestions } from "./service";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (settings are admin-only, decisions are for any staff member), validates its input, and returns codes.

export async function saveSuggestionSettingsAction(input: unknown): Promise<SaveSuggestionsResult> {
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

export async function decideSuggestionAction(input: unknown): Promise<DecideResult> {
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
