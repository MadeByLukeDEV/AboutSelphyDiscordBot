import type { Guild } from "discord.js";
import type { ManagedRole, RoleCopyStatus, RoleDeleteStatus, RoleMergeResponse, RoleMoveStatus, RoleUpdateStatus } from "@aboutselphy/shared";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { checkCopy, checkMerge, isPowerful, planMove, protectionOf } from "./manage-rules";
import { checkRole } from "./service";

// The role manager: lists every role with its member count and deletes the ones staff pick.
// Admin-only in the dashboard; the bot decides again for every id (see manage-rules.ts).

const staffRoleIds = (): Set<string> => new Set([...env().DISCORD_ADMIN_ROLE_IDS, ...env().DISCORD_MODERATOR_ROLE_IDS]);

async function botTop(guild: Guild): Promise<number> {
  return (guild.members.me ?? (await guild.members.fetchMe())).roles.highest.position;
}

/** Every role but @everyone, highest first. The member cache is filled first so the counts are right. */
export async function listManagedRoles(guild: Guild): Promise<ManagedRole[]> {
  await guild.members.fetch().catch((err) => log.warn({ err }, "role manager: could not load all members, counts may be low"));
  const roles = await guild.roles.fetch();
  const top = await botTop(guild);
  const staff = staffRoleIds();
  return [...roles.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position,
      memberCount: r.members.size,
      powerful: isPowerful(r.permissions.bitfield),
      protectedReason: protectionOf({ id: r.id, guildId: guild.id, managed: r.managed, position: r.position, permissions: r.permissions.bitfield }, top, staff),
    }));
}

/** Deletes the given roles one by one. Never throws; each id gets its own result. */
export async function deleteRoles(guild: Guild, ids: string[], by: string): Promise<Array<{ id: string; status: RoleDeleteStatus }>> {
  const top = await botTop(guild);
  const staff = staffRoleIds();
  const results: Array<{ id: string; status: RoleDeleteStatus }> = [];
  for (const id of [...new Set(ids)]) {
    const role = id === guild.id ? null : guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
    if (!role) {
      results.push({ id, status: "not-found" });
      continue;
    }
    if (protectionOf({ id: role.id, guildId: guild.id, managed: role.managed, position: role.position, permissions: role.permissions.bitfield }, top, staff) !== null) {
      log.warn({ role: id }, "role manager: refused to delete a protected role");
      results.push({ id, status: "protected" });
      continue;
    }
    try {
      await role.delete(`Deleted from the dashboard by ${by}`);
      log.info({ role: id, name: role.name, by }, "role deleted from the dashboard");
      results.push({ id, status: "deleted" });
    } catch (err) {
      log.error({ err, role: id }, "role manager: delete failed");
      results.push({ id, status: "failed" });
    }
  }
  return results;
}

/** Renames and/or recolours a role. The same protections as deleting apply (managed, above the bot, staff). */
export async function updateRole(guild: Guild, input: { id: string; name?: string; color?: number }, by: string): Promise<RoleUpdateStatus> {
  const role = input.id === guild.id ? null : guild.roles.cache.get(input.id) ?? (await guild.roles.fetch(input.id).catch(() => null));
  if (!role) return "not-found";
  const top = await botTop(guild);
  if (protectionOf({ id: role.id, guildId: guild.id, managed: role.managed, position: role.position, permissions: role.permissions.bitfield }, top, staffRoleIds()) !== null) return "protected";
  try {
    await role.edit({ ...(input.name !== undefined ? { name: input.name } : {}), ...(input.color !== undefined ? { colors: { primaryColor: input.color } } : {}), reason: `Edited from the dashboard by ${by}` });
    log.info({ role: role.id, by, renamed: input.name !== undefined, recoloured: input.color !== undefined }, "role edited from the dashboard");
    return "updated";
  } catch (err) {
    log.error({ err, role: role.id }, "role manager: edit failed");
    return "failed";
  }
}

/**
 * Gives everyone who has one of the source roles the target role, then (if asked, and only when
 * nobody was missed) deletes the sources. The target must pass checkMerge: no merge can hand out
 * a powerful or staff role.
 */
export async function mergeRoles(guild: Guild, input: { sourceIds: string[]; targetId: string; deleteSources: boolean }, by: string): Promise<RoleMergeResponse> {
  const empty = { added: 0, alreadyHad: 0, failed: 0, deleted: [] as string[] };
  const sourceIds = [...new Set(input.sourceIds)];
  const target = guild.roles.cache.get(input.targetId) ?? (await guild.roles.fetch(input.targetId).catch(() => null));
  const verdict = checkMerge({ sourceIds, targetId: input.targetId, guildId: guild.id }, target ? { assignable: checkRole(guild, target.id) === "ok" } : null, staffRoleIds());
  if (!verdict.ok) return { status: verdict.reason, ...empty };
  const sources = [];
  for (const id of sourceIds) {
    const role = guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
    if (!role) return { status: "source-invalid", ...empty };
    sources.push(role);
  }
  try {
    await guild.members.fetch();
    const holders = new Map<string, import("discord.js").GuildMember>();
    for (const role of sources) for (const m of role.members.values()) holders.set(m.id, m);
    let added = 0;
    let alreadyHad = 0;
    let failed = 0;
    for (const member of holders.values()) {
      if (member.roles.cache.has(input.targetId)) {
        alreadyHad++;
        continue;
      }
      try {
        await member.roles.add(input.targetId, `Role merge by ${by}`);
        added++;
      } catch (err) {
        failed++;
        log.warn({ err, user: member.id }, "role manager: could not give the merged role");
      }
    }
    log.info({ target: input.targetId, sources: sourceIds.length, added, alreadyHad, failed, by }, "roles merged from the dashboard");
    const deleted = input.deleteSources && failed === 0 ? (await deleteRoles(guild, sourceIds, by)).filter((r) => r.status === "deleted").map((r) => r.id) : [];
    return { status: "done", added, alreadyHad, failed, deleted };
  } catch (err) {
    log.error({ err }, "role manager: merge failed");
    return { status: "failed", ...empty };
  }
}

/** Moves a role one place up or down. The same protections as editing apply, and it never goes above the bot's own role. */
export async function moveRole(guild: Guild, input: { id: string; direction: "up" | "down" }, by: string): Promise<RoleMoveStatus> {
  const role = input.id === guild.id ? null : guild.roles.cache.get(input.id) ?? (await guild.roles.fetch(input.id).catch(() => null));
  if (!role) return "not-found";
  const top = await botTop(guild);
  if (protectionOf({ id: role.id, guildId: guild.id, managed: role.managed, position: role.position, permissions: role.permissions.bitfield }, top, staffRoleIds()) !== null) return "protected";
  const next = planMove(role.position, input.direction, top);
  if (next === null) return "edge";
  try {
    await role.setPosition(next, { reason: `Moved from the dashboard by ${by}` });
    log.info({ role: role.id, direction: input.direction, by }, "role moved from the dashboard");
    return "moved";
  } catch (err) {
    log.error({ err, role: role.id }, "role manager: move failed");
    return "failed";
  }
}

/** Gives the target role the permissions of the source role, unless the source is powerful (see checkCopy) or the target is protected. */
export async function copyPermissions(guild: Guild, input: { sourceId: string; targetId: string }, by: string): Promise<RoleCopyStatus> {
  const get = async (id: string) => guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
  const source = await get(input.sourceId);
  const target = input.targetId === guild.id ? null : await get(input.targetId);
  if (!source || !target) return "not-found";
  const top = await botTop(guild);
  if (protectionOf({ id: target.id, guildId: guild.id, managed: target.managed, position: target.position, permissions: target.permissions.bitfield }, top, staffRoleIds()) !== null) return "protected";
  const verdict = checkCopy(source.id, target.id, source.permissions.bitfield);
  if (!verdict.ok) return verdict.reason;
  try {
    await target.setPermissions(source.permissions, `Permissions copied from ${source.name} by ${by}`);
    log.info({ source: source.id, target: target.id, by }, "role permissions copied from the dashboard");
    return "done";
  } catch (err) {
    log.error({ err, target: target.id }, "role manager: copying permissions failed");
    return "failed";
  }
}
