"use server";

import { AuthorizationError, requireAdmin } from "@/modules/auth";
import {
  globalSettingsSchema,
  lobbySchema,
  type DeleteLobbyResult,
  type SaveGlobalResult,
  type SaveLobbyResult,
} from "./schema";
import { removeLobby, saveGlobal, saveLobby } from "./service";
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

/** Admins only: the master switch, the blocked words and the built-in list. */
async function saveGlobalSettingsActionRun(input: unknown): Promise<SaveGlobalResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = globalSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveGlobal(parsed.data);
}

/** Admins only: add a lobby (no id) or change one (with its id). */
async function saveLobbyActionRun(input: unknown): Promise<SaveLobbyResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = lobbySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveLobby(parsed.data);
}

/** Admins only: remove a lobby. Open rooms are left alone. */
async function removeLobbyActionRun(id: unknown): Promise<DeleteLobbyResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeLobby(id);
}

export async function saveGlobalSettingsAction(...args: Parameters<typeof saveGlobalSettingsActionRun>): ReturnType<typeof saveGlobalSettingsActionRun> {
  return audited("tempvoice.saveGlobalSettings", saveGlobalSettingsActionRun, args);
}

export async function saveLobbyAction(...args: Parameters<typeof saveLobbyActionRun>): ReturnType<typeof saveLobbyActionRun> {
  return audited("tempvoice.saveLobby", saveLobbyActionRun, args);
}

export async function removeLobbyAction(...args: Parameters<typeof removeLobbyActionRun>): ReturnType<typeof removeLobbyActionRun> {
  return audited("tempvoice.removeLobby", removeLobbyActionRun, args);
}
