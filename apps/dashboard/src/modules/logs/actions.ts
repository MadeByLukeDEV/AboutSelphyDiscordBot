"use server";

import { logSettingsSchema } from "@aboutselphy/shared/logs";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveLogsResult } from "./schema";
import { saveLogs } from "./service";

// A public POST endpoint like every Server Action: checks the session and the role itself,
// validates its input, and returns a code (never error text).
export async function saveLogSettingsAction(input: unknown): Promise<SaveLogsResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = logSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsChannel") ? "needsChannel" : "invalid" };
  return saveLogs(parsed.data);
}
