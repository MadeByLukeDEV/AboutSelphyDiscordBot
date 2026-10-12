"use server";

import { birthdaySettingsSchema, staffBirthdayInput } from "@aboutselphy/shared/birthdays";
import { z } from "zod";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveBirthdayResult, SimpleBirthdayResult } from "./schema";
import { removeBirthday, saveBirthdays, setBirthday } from "./service";
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

async function adminOnly(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}

async function setBirthdayActionRun(input: unknown): Promise<SimpleBirthdayResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = staffBirthdayInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return setBirthday(parsed.data);
}

async function removeBirthdayActionRun(input: unknown): Promise<SimpleBirthdayResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = z.object({ userId: z.string().regex(/^\d{17,20}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeBirthday(parsed.data.userId);
}

export async function setBirthdayAction(...args: Parameters<typeof setBirthdayActionRun>): ReturnType<typeof setBirthdayActionRun> {
  return audited("birthdays.setBirthday", setBirthdayActionRun, args);
}

export async function removeBirthdayAction(...args: Parameters<typeof removeBirthdayActionRun>): ReturnType<typeof removeBirthdayActionRun> {
  return audited("birthdays.removeBirthday", removeBirthdayActionRun, args);
}
