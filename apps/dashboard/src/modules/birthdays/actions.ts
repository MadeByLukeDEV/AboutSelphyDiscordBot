"use server";

import { birthdaySettingsSchema } from "@aboutselphy/shared/birthdays";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveBirthdayResult } from "./schema";
import { saveBirthdays } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoint like every Server Action: it checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

async function saveBirthdaySettingsActionRun(input: unknown): Promise<SaveBirthdayResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = birthdaySettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsTarget") ? "needsTarget" : "invalid" };
  return saveBirthdays(parsed.data);
}

export async function saveBirthdaySettingsAction(...args: Parameters<typeof saveBirthdaySettingsActionRun>): ReturnType<typeof saveBirthdaySettingsActionRun> {
  return audited("birthdays.saveBirthdaySettings", saveBirthdaySettingsActionRun, args);
}
