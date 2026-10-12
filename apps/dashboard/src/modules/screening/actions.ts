"use server";

import { screeningDecideBody, screeningSettingsSchema } from "@aboutselphy/shared/screening";
import { AuthorizationError, requireAdmin, requireStaff } from "@/modules/auth";
import type { DecideScreeningResult, SaveScreeningResult } from "./schema";
import { decideEntry, saveScreening } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (settings are admin-only, decisions are for any staff member), validates its input, and returns codes.

async function saveScreeningActionRun(input: unknown): Promise<SaveScreeningResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = screeningSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message);
    return { ok: false, error: messages.includes("needsChannel") ? "needsChannel" : messages.includes("needsRole") ? "needsRole" : messages.includes("sameRole") ? "sameRole" : "invalid" };
  }
  return saveScreening(parsed.data);
}

async function decideScreeningActionRun(input: unknown): Promise<DecideScreeningResult> {
  let session;
  try {
    session = await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  // The name comes from the session, never from the client.
  const parsed = screeningDecideBody.omit({ staffName: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return decideEntry(parsed.data.id, parsed.data.decision, session.user.name);
}

export async function saveScreeningAction(...args: Parameters<typeof saveScreeningActionRun>): ReturnType<typeof saveScreeningActionRun> {
  return audited("screening.saveScreening", saveScreeningActionRun, args);
}

export async function decideScreeningAction(...args: Parameters<typeof decideScreeningActionRun>): ReturnType<typeof decideScreeningActionRun> {
  return audited("screening.decideScreening", decideScreeningActionRun, args);
}
