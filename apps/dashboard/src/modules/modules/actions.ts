"use server";

import { moduleSwitchInput } from "@aboutselphy/shared/modules";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SetModuleResult } from "./schema";
import { setModule } from "./service";

// Public POST endpoint like every Server Action: it checks the session and the role itself (admins
// only), validates its input, and returns codes (never error text).

export async function setModuleAction(input: unknown): Promise<SetModuleResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = moduleSwitchInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return setModule(parsed.data.key, parsed.data.enabled, session.user.name);
}
