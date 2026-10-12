"use server";

import { moduleSwitchInput } from "@aboutselphy/shared/modules";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SetModuleResult } from "./schema";
import { setModule } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoint like every Server Action: it checks the session and the role itself (admins
// only), validates its input, and returns codes (never error text).

async function setModuleActionRun(input: unknown): Promise<SetModuleResult> {
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

export async function setModuleAction(...args: Parameters<typeof setModuleActionRun>): ReturnType<typeof setModuleActionRun> {
  return audited("modules.setModule", setModuleActionRun, args);
}
