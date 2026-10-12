"use server";

import { pollInput } from "@aboutselphy/shared/polls";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import type { StaffSession } from "@/modules/auth";
import type { PollActionResult, SavePollResult } from "./schema";
import { removePoll, runAction, savePoll } from "./service";

// Public POST endpoints like every Server Action: each one checks the session itself (moderators and
// admins may run polls), validates its input, and returns codes (never error text).

async function staff(): Promise<StaffSession | null> {
  try {
    return await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

/** Creates a poll, or (with `id`) changes a draft; posts it right away if `start`. */
export async function createPollAction(input: unknown, start: unknown, id?: unknown): Promise<SavePollResult> {
  const session = await staff();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = pollInput.safeParse(input);
  if (!parsed.success || typeof start !== "boolean" || (id !== undefined && !validId(id))) return { ok: false, error: "invalid" };
  return savePoll({ ...parsed.data, start }, session.user, id);
}

export async function pollControlAction(id: unknown, action: unknown): Promise<PollActionResult> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  if (!validId(id) || (action !== "start" && action !== "end")) return { ok: false, error: "invalid" };
  return runAction(id, action);
}

export async function deletePollAction(id: unknown): Promise<PollActionResult> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removePoll(id);
}
