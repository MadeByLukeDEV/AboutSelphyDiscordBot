"use server";

import { autoPublishInput } from "@aboutselphy/shared/sticky";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { AutoPublishResult } from "./schema";
import { addAutoPublish, removeAutoPublish } from "./service";

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

export async function addAutoPublishAction(input: unknown): Promise<AutoPublishResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = autoPublishInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return addAutoPublish(parsed.data.channelId);
}

export async function removeAutoPublishAction(input: unknown): Promise<AutoPublishResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = autoPublishInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeAutoPublish(parsed.data.channelId);
}
