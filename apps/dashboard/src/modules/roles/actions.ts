"use server";

import { rolePanelInput } from "@aboutselphy/shared/role-panel";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { StaffSession } from "@/modules/auth";
import { createRoleInput, type CreateRoleResult, type DeletePanelResult, type SavePanelResult } from "./schema";
import { createRoleFromDashboard, removePanel, savePanel } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoints like every Server Action: each one checks the session and the role
// itself (roles are admin-only), validates its input, and returns codes (never error text).

async function admin(): Promise<StaffSession | null> {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

async function createRoleActionRun(input: unknown): Promise<CreateRoleResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = createRoleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return createRoleFromDashboard(parsed.data, session.user);
}

async function savePanelActionRun(input: unknown): Promise<SavePanelResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = rolePanelInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return savePanel(parsed.data, session.user);
}

async function deletePanelActionRun(id: unknown): Promise<DeletePanelResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removePanel(id);
}

export async function createRoleAction(...args: Parameters<typeof createRoleActionRun>): ReturnType<typeof createRoleActionRun> {
  return audited("roles.createRole", createRoleActionRun, args);
}

export async function savePanelAction(...args: Parameters<typeof savePanelActionRun>): ReturnType<typeof savePanelActionRun> {
  return audited("roles.savePanel", savePanelActionRun, args);
}

export async function deletePanelAction(...args: Parameters<typeof deletePanelActionRun>): ReturnType<typeof deletePanelActionRun> {
  return audited("roles.deletePanel", deletePanelActionRun, args);
}
