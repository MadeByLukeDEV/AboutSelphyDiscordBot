"use server";

import { verificationSettingsSchema } from "@aboutselphy/shared/entry";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { PostPanelResult, SaveVerificationResult } from "./schema";
import { postPanel, saveVerification } from "./service";
import { audited } from "@/modules/audit";

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

async function saveVerificationActionRun(input: unknown): Promise<SaveVerificationResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = verificationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path[0]);
    return { ok: false, error: paths.includes("channelId") ? "needsChannel" : paths.includes("verifiedRoleId") ? "needsRole" : "invalid" };
  }
  return saveVerification(parsed.data);
}

async function postVerificationPanelActionRun(): Promise<PostPanelResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  return postPanel();
}

export async function saveVerificationAction(...args: Parameters<typeof saveVerificationActionRun>): ReturnType<typeof saveVerificationActionRun> {
  return audited("verification.saveVerification", saveVerificationActionRun, args);
}

export async function postVerificationPanelAction(...args: Parameters<typeof postVerificationPanelActionRun>): ReturnType<typeof postVerificationPanelActionRun> {
  return audited("verification.postVerificationPanel", postVerificationPanelActionRun, args);
}
