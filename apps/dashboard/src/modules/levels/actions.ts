"use server";

import { levelSettingsSchema } from "@aboutselphy/shared/levels";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveLevelsResult } from "./schema";
import { saveLevels } from "./service";

// A public POST endpoint like every Server Action: checks the session and the role itself,
// validates its input, and returns a code (never error text).
export async function saveLevelSettingsAction(input: unknown): Promise<SaveLevelsResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = levelSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsChannel") ? "needsChannel" : "invalid" };
  return saveLevels(parsed.data);
}
