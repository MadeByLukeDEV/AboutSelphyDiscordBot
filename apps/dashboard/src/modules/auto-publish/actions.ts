"use server";

import { autoPublishInput } from "@aboutselphy/shared/sticky";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { AutoPublishResult } from "./schema";
import { addAutoPublish, removeAutoPublish } from "./service";
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

async function addAutoPublishActionRun(input: unknown): Promise<AutoPublishResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = autoPublishInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return addAutoPublish(parsed.data.channelId);
}

async function removeAutoPublishActionRun(input: unknown): Promise<AutoPublishResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = autoPublishInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeAutoPublish(parsed.data.channelId);
}

export async function addAutoPublishAction(...args: Parameters<typeof addAutoPublishActionRun>): ReturnType<typeof addAutoPublishActionRun> {
  return audited("auto-publish.addAutoPublish", addAutoPublishActionRun, args);
}

export async function removeAutoPublishAction(...args: Parameters<typeof removeAutoPublishActionRun>): ReturnType<typeof removeAutoPublishActionRun> {
  return audited("auto-publish.removeAutoPublish", removeAutoPublishActionRun, args);
}
