"use server";

import { reminderSettingsSchema } from "@aboutselphy/shared/reminders";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveReminderResult } from "./schema";
import { saveReminders } from "./service";

// Public POST endpoint like every Server Action: it checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

export async function saveReminderSettingsAction(input: unknown): Promise<SaveReminderResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = reminderSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveReminders(parsed.data);
}
