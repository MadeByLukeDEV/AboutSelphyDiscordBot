"use server";

import { antiBotSettingsSchema } from "@aboutselphy/shared/antibot";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveAntiBotResult } from "./schema";
import { saveAntiBot } from "./service";
import { audited } from "@/modules/audit";

// A public POST endpoint like every Server Action: it checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

async function saveAntiBotActionRun(input: unknown): Promise<SaveAntiBotResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = antiBotSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "channelId") ? "needsChannel" : "invalid" };
  return saveAntiBot(parsed.data);
}

export async function saveAntiBotAction(...args: Parameters<typeof saveAntiBotActionRun>): ReturnType<typeof saveAntiBotActionRun> {
  return audited("antibot.saveAntiBot", saveAntiBotActionRun, args);
}
