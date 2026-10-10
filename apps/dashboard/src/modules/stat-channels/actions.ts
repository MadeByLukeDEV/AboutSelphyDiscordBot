"use server";

import { statChannelInput } from "@aboutselphy/shared/stat-channels";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveStatChannelResult } from "./schema";
import { removeStatChannel, saveStatChannel } from "./service";

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

export async function saveStatChannelAction(input: unknown): Promise<SaveStatChannelResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = statChannelInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsCount") ? "needsCount" : "invalid" };
  return saveStatChannel(parsed.data);
}

export async function removeStatChannelAction(id: unknown): Promise<SaveStatChannelResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeStatChannel(id);
}
