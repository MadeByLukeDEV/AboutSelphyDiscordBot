"use server";

import { gameSettingsSchema } from "@aboutselphy/shared/games";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { audited } from "@/modules/audit";
import type { SaveGamesResult } from "./schema";
import { saveGames } from "./service";

// A public POST endpoint like every Server Action: it checks the session and the role itself (admins only),
// validates its input, and returns codes (never error text).
async function saveGamesActionRun(input: unknown): Promise<SaveGamesResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = gameSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveGames(parsed.data);
}

export async function saveGamesAction(...args: Parameters<typeof saveGamesActionRun>): ReturnType<typeof saveGamesActionRun> {
  return audited("games.saveGames", saveGamesActionRun, args);
}
