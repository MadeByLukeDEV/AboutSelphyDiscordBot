"use server";

import { starboardSettingsSchema } from "@aboutselphy/shared/starboard";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveStarboardResult } from "./schema";
import { saveStarboard } from "./service";

// Public POST endpoint like every Server Action: it checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

export async function saveStarboardAction(input: unknown): Promise<SaveStarboardResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = starboardSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsChannel") ? "needsChannel" : "invalid" };
  return saveStarboard(parsed.data);
}
