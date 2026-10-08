import type { GuildMember } from "discord.js";
import { env } from "./env";

export type StaffLevel = "admin" | "moderator";

/**
 * Staff level from the member's Discord roles (same role IDs the auth service
 * uses for the dashboard). The guild owner counts as admin. Admin wins if the
 * member has both.
 */
export function staffLevel(member: GuildMember | null): StaffLevel | null {
  if (!member) return null;
  if (member.guild.ownerId === member.id) return "admin";
  const e = env();
  const has = (ids: string[]) => ids.some((id) => member.roles.cache.has(id));
  if (has(e.DISCORD_ADMIN_ROLE_IDS)) return "admin";
  if (has(e.DISCORD_MODERATOR_ROLE_IDS)) return "moderator";
  return null;
}
