"use server";

import { z } from "zod";
import { MAX_MERGE_SOURCES, MAX_ROLE_DELETES } from "@aboutselphy/shared";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { CleanupResult, DeleteRolesResult, MergeRolesResult, UpdateRoleResult } from "./schema";
import { cleanupDangling, deleteRoles, mergeRoles, updateRole } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text). Deleting and merging
// can't be undone, so the confirmation lives in the UI and the bot re-checks every role.

const id = z.string().regex(/^\d{17,20}$/);
const deleteInput = z.array(id).min(1).max(MAX_ROLE_DELETES);
const updateInput = z
  .object({ id, name: z.string().trim().min(1).max(100).optional(), color: z.number().int().min(0).max(0xffffff).optional() })
  .refine((v) => v.name !== undefined || v.color !== undefined);
const mergeInput = z.object({ sourceIds: z.array(id).min(1).max(MAX_MERGE_SOURCES), targetId: id, deleteSources: z.boolean() });

async function admin() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

async function deleteRolesActionRun(ids: unknown): Promise<DeleteRolesResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = deleteInput.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return deleteRoles(parsed.data, session.user.name);
}

async function updateRoleActionRun(input: unknown): Promise<UpdateRoleResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return updateRole(parsed.data, session.user.name);
}

async function mergeRolesActionRun(input: unknown): Promise<MergeRolesResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = mergeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return mergeRoles(parsed.data, session.user.name);
}

async function cleanupDanglingActionRun(): Promise<CleanupResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  return cleanupDangling(session.user.name);
}

export async function deleteRolesAction(...args: Parameters<typeof deleteRolesActionRun>): ReturnType<typeof deleteRolesActionRun> {
  return audited("role-manager.deleteRoles", deleteRolesActionRun, args);
}

export async function updateRoleAction(...args: Parameters<typeof updateRoleActionRun>): ReturnType<typeof updateRoleActionRun> {
  return audited("role-manager.updateRole", updateRoleActionRun, args);
}

export async function mergeRolesAction(...args: Parameters<typeof mergeRolesActionRun>): ReturnType<typeof mergeRolesActionRun> {
  return audited("role-manager.mergeRoles", mergeRolesActionRun, args);
}

export async function cleanupDanglingAction(...args: Parameters<typeof cleanupDanglingActionRun>): ReturnType<typeof cleanupDanglingActionRun> {
  return audited("role-manager.cleanupDangling", cleanupDanglingActionRun, args);
}
