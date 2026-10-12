"use server";

import { levelSettingsSchema } from "@aboutselphy/shared/levels";
import { MAX_IMPORT_CHARS } from "@aboutselphy/shared/levels-import";
import { z } from "zod";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { ImportXpResult, SaveLevelsResult } from "./schema";
import { importXp, saveLevels } from "./service";
import { audited } from "@/modules/audit";

// A public POST endpoint like every Server Action: checks the session and the role itself,
// validates its input, and returns a code (never error text).
async function saveLevelSettingsActionRun(input: unknown): Promise<SaveLevelsResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = levelSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsChannel") ? "needsChannel" : "invalid" };
  return saveLevels(parsed.data);
}

export async function saveLevelSettingsAction(...args: Parameters<typeof saveLevelSettingsActionRun>): ReturnType<typeof saveLevelSettingsActionRun> {
  return audited("levels.saveLevelSettings", saveLevelSettingsActionRun, args);
}

async function importXpActionRun(input: unknown): Promise<ImportXpResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = z.object({ text: z.string().max(MAX_IMPORT_CHARS) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return importXp(parsed.data.text);
}

export async function importXpAction(...args: Parameters<typeof importXpActionRun>): ReturnType<typeof importXpActionRun> {
  return audited("levels.importXp", importXpActionRun, args);
}
