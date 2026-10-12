"use server";

import { modGuideInput } from "@aboutselphy/shared/modguide";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { PostModGuideResult, SaveModGuideResult } from "./schema";
import { postModGuide, saveModGuide } from "./service";
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

async function saveModGuideActionRun(input: unknown): Promise<SaveModGuideResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = modGuideInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveModGuide(parsed.data);
}

async function postModGuideActionRun(): Promise<PostModGuideResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  return postModGuide();
}

export async function saveModGuideAction(...args: Parameters<typeof saveModGuideActionRun>): ReturnType<typeof saveModGuideActionRun> {
  return audited("modguide.saveModGuide", saveModGuideActionRun, args);
}

export async function postModGuideAction(...args: Parameters<typeof postModGuideActionRun>): ReturnType<typeof postModGuideActionRun> {
  return audited("modguide.postModGuide", postModGuideActionRun, args);
}
