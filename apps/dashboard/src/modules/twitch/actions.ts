"use server";

import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { streamerSchema, twitchSettingsSchema, type SaveStreamerResult, type SaveTwitchResult, type SimpleResult } from "./schema";
import { disconnectTwitch, pauseStreamer, removeStreamer, saveStreamer, saveTwitchSettings } from "./service";

// Public POST endpoints like every Server Action: each one checks the session
// and the role itself, validates its input, and returns codes (never error text).

async function adminOnly(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

export async function saveTwitchSettingsAction(input: unknown): Promise<SaveTwitchResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = twitchSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveTwitchSettings(parsed.data);
}

/** Admins only: add a channel (no id) or change one (with its id). */
export async function saveStreamerAction(input: unknown): Promise<SaveStreamerResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = streamerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveStreamer(parsed.data);
}

export async function removeStreamerAction(id: unknown): Promise<SimpleResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeStreamer(id);
}

export async function setStreamerEnabledAction(id: unknown, enabled: unknown): Promise<SimpleResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  if (!validId(id) || typeof enabled !== "boolean") return { ok: false, error: "invalid" };
  return pauseStreamer(id, enabled);
}

export async function disconnectTwitchAction(): Promise<SimpleResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  return disconnectTwitch();
}
