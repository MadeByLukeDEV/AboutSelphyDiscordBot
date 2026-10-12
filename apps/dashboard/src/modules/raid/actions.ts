"use server";

import { raidSettingsSchema } from "@aboutselphy/shared/entry";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveRaidResult } from "./schema";
import { saveRaid } from "./service";
import { audited } from "@/modules/audit";

// A public POST endpoint like every Server Action: it checks the session and the role itself (admins only),
// validates its input, and returns codes (never error text).
async function saveRaidActionRun(input: unknown): Promise<SaveRaidResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = raidSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveRaid(parsed.data);
}

export async function saveRaidAction(...args: Parameters<typeof saveRaidActionRun>): ReturnType<typeof saveRaidActionRun> {
  return audited("raid.saveRaid", saveRaidActionRun, args);
}
