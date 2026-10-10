import type { Guild } from "discord.js";
import type { ManagedRole, RoleDeleteStatus } from "@aboutselphy/shared";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { isPowerful, protectionOf } from "./manage-rules";

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
