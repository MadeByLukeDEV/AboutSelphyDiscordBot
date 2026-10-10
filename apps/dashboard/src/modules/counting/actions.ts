"use server";

import { countingSettingsSchema } from "@aboutselphy/shared/counting";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { ResetCountingResult, SaveCountingResult } from "./schema";
import { resetCounting, saveCounting } from "./service";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

async function adminOnly(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}

export async function saveCountingAction(input: unknown): Promise<SaveCountingResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = countingSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsChannel") ? "needsChannel" : "invalid" };
  return saveCounting(parsed.data);
}

export async function resetCountingAction(): Promise<ResetCountingResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  return resetCounting();
}
