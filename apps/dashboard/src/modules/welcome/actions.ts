"use server";

import { welcomeSettingsSchema } from "@aboutselphy/shared/welcome";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveWelcomeResult } from "./schema";
import { saveWelcome } from "./service";

// A public POST endpoint like every Server Action: checks the session and the role itself,
// validates its input, and returns a code (never error text).
export async function saveWelcomeSettingsAction(input: unknown): Promise<SaveWelcomeResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = welcomeSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsChannel") ? "needsChannel" : "invalid" };
  return saveWelcome(parsed.data);
}
