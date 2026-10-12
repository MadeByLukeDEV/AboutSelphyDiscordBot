"use server";

import { stickyInput } from "@aboutselphy/shared/sticky";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { StickyResult } from "./schema";
import { removeSticky, saveSticky } from "./service";
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

async function saveStickyActionRun(input: unknown): Promise<StickyResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = stickyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveSticky(parsed.data);
}

async function removeStickyActionRun(id: unknown): Promise<StickyResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeSticky(id);
}

export async function saveStickyAction(...args: Parameters<typeof saveStickyActionRun>): ReturnType<typeof saveStickyActionRun> {
  return audited("sticky.saveSticky", saveStickyActionRun, args);
}

export async function removeStickyAction(...args: Parameters<typeof removeStickyActionRun>): ReturnType<typeof removeStickyActionRun> {
  return audited("sticky.removeSticky", removeStickyActionRun, args);
}
