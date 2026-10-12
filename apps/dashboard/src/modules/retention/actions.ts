"use server";

import { retentionSettingsSchema } from "@aboutselphy/shared/retention";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveRetentionResult } from "./schema";
import { saveRetention } from "./service";

// A public POST endpoint like every Server Action: it checks the session and the role itself (admins only),
// validates its input, and returns codes (never error text).
export async function saveRetentionAction(input: unknown): Promise<SaveRetentionResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = retentionSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveRetention(parsed.data);
}
