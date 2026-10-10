"use server";

import { z } from "zod";
import { MAX_ROLE_DELETES } from "@aboutselphy/shared";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { DeleteRolesResult } from "./schema";
import { deleteRoles } from "./service";

// Public POST endpoint like every Server Action: it checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text). Deleting roles can't
// be undone, so the confirmation lives in the UI and the bot re-checks every role.

const input = z.array(z.string().regex(/^\d{17,20}$/)).min(1).max(MAX_ROLE_DELETES);

export async function deleteRolesAction(ids: unknown): Promise<DeleteRolesResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = input.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return deleteRoles(parsed.data, session.user.name);
}
