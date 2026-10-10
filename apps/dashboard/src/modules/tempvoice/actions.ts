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
export async function saveGlobalSettingsAction(input: unknown): Promise<SaveGlobalResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = globalSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveGlobal(parsed.data);
}

/** Admins only: add a lobby (no id) or change one (with its id). */
export async function saveLobbyAction(input: unknown): Promise<SaveLobbyResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = lobbySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveLobby(parsed.data);
}

/** Admins only: remove a lobby. Open rooms are left alone. */
export async function removeLobbyAction(id: unknown): Promise<DeleteLobbyResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeLobby(id);
}
