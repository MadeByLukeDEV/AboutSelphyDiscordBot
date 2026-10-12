"use server";

import { customCommandInput } from "@aboutselphy/shared/custom-commands";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveCustomCommandResult } from "./schema";
import { removeCustomCommand, saveCustomCommand } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

async function admin() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

async function saveCustomCommandActionRun(input: unknown): Promise<SaveCustomCommandResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = customCommandInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "name") ? "badName" : "invalid" };
  return saveCustomCommand(parsed.data, session.user.name);
}

async function removeCustomCommandActionRun(id: unknown): Promise<SaveCustomCommandResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeCustomCommand(id);
}

export async function saveCustomCommandAction(...args: Parameters<typeof saveCustomCommandActionRun>): ReturnType<typeof saveCustomCommandActionRun> {
  return audited("custom-commands.saveCustomCommand", saveCustomCommandActionRun, args);
}

export async function removeCustomCommandAction(...args: Parameters<typeof removeCustomCommandActionRun>): ReturnType<typeof removeCustomCommandActionRun> {
  return audited("custom-commands.removeCustomCommand", removeCustomCommandActionRun, args);
}
