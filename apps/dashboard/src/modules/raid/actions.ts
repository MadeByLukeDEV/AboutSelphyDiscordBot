"use server";

import { raidSettingsSchema } from "@aboutselphy/shared/entry";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveRaidResult } from "./schema";
import { saveRaid } from "./service";

// A public POST endpoint like every Server Action: it checks the session and the role itself (admins only),
// validates its input, and returns codes (never error text).
export async function saveRaidAction(input: unknown): Promise<SaveRaidResult> {
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
