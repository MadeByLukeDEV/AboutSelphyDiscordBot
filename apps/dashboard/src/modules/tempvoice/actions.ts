"use server";

import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { settingsSchema, type SaveSettingsResult } from "./schema";
import { saveSettings } from "./service";

// A public POST endpoint like every Server Action: it checks the session and the
// role itself, validates its input, and returns codes (never error text).

/** Admins only: the lobby, where rooms go, the defaults and the blocked words. */
export async function saveTempVoiceSettingsAction(input: unknown): Promise<SaveSettingsResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const needsLobby = parsed.error.issues.some((i) => i.message === "needsLobby");
    return { ok: false, error: needsLobby ? "needsLobby" : "invalid" };
  }
  return saveSettings(parsed.data);
}
