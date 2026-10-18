"use server";

import { memberOverviewInput } from "@aboutselphy/shared/memberoverview";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { audited } from "@/modules/audit";
import type { PostMemberOverviewResult, SaveMemberOverviewResult } from "./schema";
import { postMemberOverview, saveMemberOverview } from "./service";

// Public POST endpoints like every Server Action: each one checks the session and the role itself (admins only),
// validates its input, and returns codes (never error text).

async function adminOnly(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}

async function saveMemberOverviewActionRun(input: unknown): Promise<SaveMemberOverviewResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = memberOverviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveMemberOverview(parsed.data);
}

async function postMemberOverviewActionRun(): Promise<PostMemberOverviewResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  return postMemberOverview();
}

export async function saveMemberOverviewAction(...args: Parameters<typeof saveMemberOverviewActionRun>): ReturnType<typeof saveMemberOverviewActionRun> {
  return audited("memberoverview.saveMemberOverview", saveMemberOverviewActionRun, args);
}

export async function postMemberOverviewAction(...args: Parameters<typeof postMemberOverviewActionRun>): ReturnType<typeof postMemberOverviewActionRun> {
  return audited("memberoverview.postMemberOverview", postMemberOverviewActionRun, args);
}
