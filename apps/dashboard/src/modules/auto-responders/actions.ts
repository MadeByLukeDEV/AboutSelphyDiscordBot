"use server";

import { autoResponderInput } from "@aboutselphy/shared/auto-responders";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveAutoResponderResult } from "./schema";
import { removeAutoResponder, saveAutoResponder } from "./service";
import { audited } from "@/modules/audit";

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

async function saveAutoResponderActionRun(input: unknown): Promise<SaveAutoResponderResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = autoResponderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveAutoResponder(parsed.data, session.user.name);
}

async function removeAutoResponderActionRun(id: unknown): Promise<SaveAutoResponderResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeAutoResponder(id);
}

export async function saveAutoResponderAction(...args: Parameters<typeof saveAutoResponderActionRun>): ReturnType<typeof saveAutoResponderActionRun> {
  return audited("auto-responders.saveAutoResponder", saveAutoResponderActionRun, args);
}

export async function removeAutoResponderAction(...args: Parameters<typeof removeAutoResponderActionRun>): ReturnType<typeof removeAutoResponderActionRun> {
  return audited("auto-responders.removeAutoResponder", removeAutoResponderActionRun, args);
}
