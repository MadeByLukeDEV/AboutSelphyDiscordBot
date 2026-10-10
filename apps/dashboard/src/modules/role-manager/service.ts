import "server-only";
import { deleteRolesViaBot, listManagedRoles } from "@/modules/bot-api";
import { errorInfo } from "@/lib/log";
import { roleUsage } from "./repository";
import type { DeleteRolesResult, RoleRow } from "./schema";

/** Every role with its member count and where it is still used (null = the bot can't be reached). */
export async function getRoleManagerPage(): Promise<{ roles: RoleRow[] | null }> {
  const [roles, usage] = await Promise.all([listManagedRoles(), roleUsage()]);
  if (!roles) return { roles: null };
  return { roles: roles.map((r) => ({ ...r, usedBy: [...(usage.get(r.id) ?? [])] })) };
}

/** Asks the bot to delete the roles; the bot refuses managed, too-high and staff roles on its own. */
export async function deleteRoles(ids: string[], byName: string): Promise<DeleteRolesResult> {
  try {
    const results = await deleteRolesViaBot(ids, byName);
    if (!results) return { ok: false, error: "botUnavailable" };
    console.info("[role-manager] delete requested", { by: byName, requested: ids.length, deleted: results.filter((r) => r.status === "deleted").length });
    return {
      ok: true,
      deleted: results.filter((r) => r.status === "deleted").map((r) => r.id),
      skipped: results.filter((r) => r.status !== "deleted").map((r) => ({ id: r.id, status: r.status as "not-found" | "protected" | "failed" })),
    };
  } catch (error) {
    console.error("[role-manager] delete failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
