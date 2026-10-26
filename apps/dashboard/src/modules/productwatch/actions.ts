"use server";

import { productWatchInput } from "@aboutselphy/shared/productwatch";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { audited } from "@/modules/audit";
import type { ProductWatchResult } from "./schema";
import { checkWatchesNow, removeWatch, saveWatch } from "./service";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

async function admin() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

async function saveProductWatchActionRun(input: unknown): Promise<ProductWatchResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = productWatchInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveWatch(parsed.data, session.user.name);
}

async function removeProductWatchActionRun(id: unknown): Promise<ProductWatchResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeWatch(id);
}

export async function checkProductWatchesAction(): Promise<ProductWatchResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  return checkWatchesNow();
}

export async function saveProductWatchAction(...args: Parameters<typeof saveProductWatchActionRun>): ReturnType<typeof saveProductWatchActionRun> {
  return audited("productwatch.saveProductWatch", saveProductWatchActionRun, args);
}

export async function removeProductWatchAction(...args: Parameters<typeof removeProductWatchActionRun>): ReturnType<typeof removeProductWatchActionRun> {
  return audited("productwatch.removeProductWatch", removeProductWatchActionRun, args);
}
