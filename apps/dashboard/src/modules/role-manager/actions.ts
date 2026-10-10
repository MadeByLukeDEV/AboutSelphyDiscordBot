"use server";

import { z } from "zod";
import { MAX_MERGE_SOURCES, MAX_ROLE_DELETES } from "@aboutselphy/shared";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { CleanupResult, DeleteRolesResult, MergeRolesResult, UpdateRoleResult } from "./schema";
import { cleanupDangling, deleteRoles, mergeRoles, updateRole } from "./service";

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

export async function deleteRolesAction(ids: unknown): Promise<DeleteRolesResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = deleteInput.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return deleteRoles(parsed.data, session.user.name);
}

export async function updateRoleAction(input: unknown): Promise<UpdateRoleResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return updateRole(parsed.data, session.user.name);
}

export async function mergeRolesAction(input: unknown): Promise<MergeRolesResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = mergeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return mergeRoles(parsed.data, session.user.name);
}

export async function cleanupDanglingAction(): Promise<CleanupResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  return cleanupDangling(session.user.name);
}
