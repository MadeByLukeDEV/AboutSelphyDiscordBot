"use server";

import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { streamerSchema, twitchSettingsSchema, type SaveStreamerResult, type SaveTwitchResult, type SimpleResult } from "./schema";
import { disconnectTwitch, pauseStreamer, removeStreamer, saveStreamer, saveTwitchSettings } from "./service";
import { audited } from "@/modules/audit";

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

async function saveTwitchSettingsActionRun(input: unknown): Promise<SaveTwitchResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = twitchSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveTwitchSettings(parsed.data);
}

/** Admins only: add a channel (no id) or change one (with its id). */
async function saveStreamerActionRun(input: unknown): Promise<SaveStreamerResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = streamerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveStreamer(parsed.data);
}

async function removeStreamerActionRun(id: unknown): Promise<SimpleResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeStreamer(id);
}

async function setStreamerEnabledActionRun(id: unknown, enabled: unknown): Promise<SimpleResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  if (!validId(id) || typeof enabled !== "boolean") return { ok: false, error: "invalid" };
  return pauseStreamer(id, enabled);
}

async function disconnectTwitchActionRun(): Promise<SimpleResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  return disconnectTwitch();
}

export async function saveTwitchSettingsAction(...args: Parameters<typeof saveTwitchSettingsActionRun>): ReturnType<typeof saveTwitchSettingsActionRun> {
  return audited("twitch.saveTwitchSettings", saveTwitchSettingsActionRun, args);
}

export async function saveStreamerAction(...args: Parameters<typeof saveStreamerActionRun>): ReturnType<typeof saveStreamerActionRun> {
  return audited("twitch.saveStreamer", saveStreamerActionRun, args);
}

export async function removeStreamerAction(...args: Parameters<typeof removeStreamerActionRun>): ReturnType<typeof removeStreamerActionRun> {
  return audited("twitch.removeStreamer", removeStreamerActionRun, args);
}

export async function setStreamerEnabledAction(...args: Parameters<typeof setStreamerEnabledActionRun>): ReturnType<typeof setStreamerEnabledActionRun> {
  return audited("twitch.setStreamerEnabled", setStreamerEnabledActionRun, args);
}

export async function disconnectTwitchAction(...args: Parameters<typeof disconnectTwitchActionRun>): ReturnType<typeof disconnectTwitchActionRun> {
  return audited("twitch.disconnectTwitch", disconnectTwitchActionRun, args);
}
