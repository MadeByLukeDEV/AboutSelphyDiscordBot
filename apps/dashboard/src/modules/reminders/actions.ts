"use server";

import { reminderSettingsSchema } from "@aboutselphy/shared/reminders";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveReminderResult } from "./schema";
import { saveReminders } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoint like every Server Action: it checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

async function saveReminderSettingsActionRun(input: unknown): Promise<SaveReminderResult> {
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

export async function saveReminderSettingsAction(...args: Parameters<typeof saveReminderSettingsActionRun>): ReturnType<typeof saveReminderSettingsActionRun> {
  return audited("reminders.saveReminderSettings", saveReminderSettingsActionRun, args);
}
