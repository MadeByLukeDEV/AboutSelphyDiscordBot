"use server";

import { eraseMemberBody, retentionSettingsSchema } from "@aboutselphy/shared/retention";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { EraseMemberResult, SaveRetentionResult } from "./schema";
import { eraseMember, saveRetention } from "./service";
import { audited } from "@/modules/audit";

// A public POST endpoint like every Server Action: it checks the session and the role itself (admins only),
// validates its input, and returns codes (never error text).
async function saveRetentionActionRun(input: unknown): Promise<SaveRetentionResult> {
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

export async function saveRetentionAction(...args: Parameters<typeof saveRetentionActionRun>): ReturnType<typeof saveRetentionActionRun> {
  return audited("retention.saveRetention", saveRetentionActionRun, args);
}

async function eraseMemberDataActionRun(input: unknown): Promise<EraseMemberResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = eraseMemberBody.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return eraseMember(parsed.data.userId);
}

export async function eraseMemberDataAction(...args: Parameters<typeof eraseMemberDataActionRun>): ReturnType<typeof eraseMemberDataActionRun> {
  return audited("retention.eraseMemberData", eraseMemberDataActionRun, args);
}
