import "server-only";
import { deleteRolesViaBot, listManagedRoles, mergeRolesViaBot, reloadBotModule, updateRoleViaBot } from "@/modules/bot-api";
import { errorInfo } from "@/lib/log";
import { references, removeReferences } from "./repository";
import type { CleanupResult, DeleteRolesResult, Dangling, MergeRolesResult, RoleRow, UpdateRoleResult, UsageKey } from "./schema";

/** Every role with its member count and where it is still used, plus settings that point at roles that are gone (null = the bot can't be reached). */
export async function getRoleManagerPage(): Promise<{ roles: RoleRow[] | null; dangling: Dangling }> {
  const [roles, refs] = await Promise.all([listManagedRoles(), references()]);
  if (!roles) return { roles: null, dangling: [] };
  const usage = new Map<string, Set<UsageKey>>();
  for (const r of refs) {
    if (!usage.has(r.roleId)) usage.set(r.roleId, new Set());
    usage.get(r.roleId)!.add(r.key);
  }
  const existing = new Set(roles.map((r) => r.id));
  const counts = new Map<UsageKey, number>();
  for (const r of refs) if (!existing.has(r.roleId)) counts.set(r.key, (counts.get(r.key) ?? 0) + 1);
  return {
    roles: roles.map((r) => ({ ...r, usedBy: [...(usage.get(r.id) ?? [])] })),
    dangling: [...counts].map(([key, count]) => ({ key, count })),
  };
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

export async function updateRole(input: { id: string; name?: string; color?: number }, byName: string): Promise<UpdateRoleResult> {
  const status = await updateRoleViaBot(input, byName);
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "updated") return { ok: true };
  return { ok: false, error: status === "not-found" ? "notFound" : status === "protected" ? "protected" : "failed" };
}

export async function mergeRoles(input: { sourceIds: string[]; targetId: string; deleteSources: boolean }, byName: string): Promise<MergeRolesResult> {
  const result = await mergeRolesViaBot(input, byName);
  if (!result) return { ok: false, error: "botUnavailable" };
  if (result.status === "done") return { ok: true, added: result.added, alreadyHad: result.alreadyHad, failed: result.failed, deleted: result.deleted };
  return { ok: false, error: result.status === "target-invalid" ? "targetInvalid" : result.status === "source-invalid" ? "sourceInvalid" : "failed" };
}

const MODULE_OF: Record<UsageKey, Parameters<typeof reloadBotModule>[0] | null> = {
  panel: null,
  levelReward: "levels",
  welcome: "welcome",
  noXp: "levels",
  tickets: "tickets",
  giveaway: "giveaways",
  announcement: "announcements",
  twitch: "twitch",
  youtube: "youtube",
  birthday: "birthdays",
};

/** Removes every setting that points at a role which no longer exists. Recomputed here from the bot's current role list, never from the client. */
export async function cleanupDangling(byName: string): Promise<CleanupResult> {
  try {
    const roles = await listManagedRoles();
    if (!roles) return { ok: false, error: "botUnavailable" };
    const existing = new Set(roles.map((r) => r.id));
    const missing = [...new Set((await references()).map((r) => r.roleId).filter((id) => !existing.has(id)))];
    if (missing.length === 0) return { ok: true, removed: {} };
    const removed = await removeReferences(missing);
    console.info("[role-manager] cleaned up settings pointing at deleted roles", { by: byName, roles: missing.length, removed });
    const modules = new Set((Object.keys(removed) as UsageKey[]).map((k) => MODULE_OF[k]).filter((m): m is NonNullable<typeof m> => m !== null));
    await Promise.all([...modules].map((m) => reloadBotModule(m)));
    return { ok: true, removed };
  } catch (error) {
    console.error("[role-manager] cleanup failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
