"use server";

import { giveawayInput } from "@aboutselphy/shared/giveaways";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import type { StaffSession } from "@/modules/auth";
import type { GiveawayActionResult, SaveGiveawayResult } from "./schema";
import { removeGiveaway, runAction, saveGiveaway } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoints like every Server Action: each one checks the session itself (moderators and
// admins may run giveaways), validates its input, and returns codes (never error text).

async function staff(): Promise<StaffSession | null> {
  try {
    return await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

async function saveGiveawayActionRun(input: unknown): Promise<SaveGiveawayResult> {
  const session = await staff();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = giveawayInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveGiveaway(parsed.data, session.user);
}

async function giveawayControlActionRun(id: unknown, action: unknown): Promise<GiveawayActionResult> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  if (!validId(id) || (action !== "end" && action !== "reroll" && action !== "cancel")) return { ok: false, error: "invalid" };
  return runAction(id, action);
}

async function deleteGiveawayActionRun(id: unknown): Promise<GiveawayActionResult> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeGiveaway(id);
}

export async function saveGiveawayAction(...args: Parameters<typeof saveGiveawayActionRun>): ReturnType<typeof saveGiveawayActionRun> {
  return audited("giveaways.saveGiveaway", saveGiveawayActionRun, args);
}

export async function giveawayControlAction(...args: Parameters<typeof giveawayControlActionRun>): ReturnType<typeof giveawayControlActionRun> {
  return audited("giveaways.giveawayControl", giveawayControlActionRun, args);
}

export async function deleteGiveawayAction(...args: Parameters<typeof deleteGiveawayActionRun>): ReturnType<typeof deleteGiveawayActionRun> {
  return audited("giveaways.deleteGiveaway", deleteGiveawayActionRun, args);
}
