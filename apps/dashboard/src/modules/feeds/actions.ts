"use server";

import { feedInput } from "@aboutselphy/shared/feeds";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { CheckFeedResult, SaveFeedResult } from "./schema";
import { checkFeedNow, removeFeed, saveFeed } from "./service";
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

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

async function saveFeedActionRun(input: unknown): Promise<SaveFeedResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = feedInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveFeed(parsed.data, session.user.name);
}

async function removeFeedActionRun(id: unknown): Promise<SaveFeedResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeFeed(id);
}

export async function checkFeedAction(id: unknown): Promise<CheckFeedResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return checkFeedNow(id);
}

export async function saveFeedAction(...args: Parameters<typeof saveFeedActionRun>): ReturnType<typeof saveFeedActionRun> {
  return audited("feeds.saveFeed", saveFeedActionRun, args);
}

export async function removeFeedAction(...args: Parameters<typeof removeFeedActionRun>): ReturnType<typeof removeFeedActionRun> {
  return audited("feeds.removeFeed", removeFeedActionRun, args);
}
