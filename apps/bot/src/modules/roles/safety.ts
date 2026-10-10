import { PermissionFlagsBits as P } from "discord.js";

// Which roles the bot will hand out on a click. A role panel is open to every member, so
// a role with real power must never be reachable through one, even if an admin picks it by
// mistake (or a staff member's panel is edited later). Pure, so the rule is testable.

/** Anything that lets someone change the server, other members or the people below them. */
export const DANGEROUS_PERMISSIONS: bigint =
  P.Administrator |
  P.ManageGuild |
  P.ManageRoles |
  P.ManageChannels |
  P.ManageWebhooks |
  P.ManageNicknames |
  P.ManageMessages |
  P.ManageThreads |
  P.ManageEvents |
  P.ManageGuildExpressions |
  P.KickMembers |
  P.BanMembers |
  P.ModerateMembers |
  P.MentionEveryone |
  P.ViewAuditLog |
  P.MoveMembers |
  P.MuteMembers |
  P.DeafenMembers;

export type RoleFacts = {
  id: string;
  guildId: string;
  managed: boolean;
  position: number;
  permissions: bigint;
};

export type Unassignable = "everyone" | "managed" | "aboveBot" | "dangerous";

/** Null when the bot may hand the role out, otherwise why not. */
export function whyUnassignable(role: RoleFacts, botTopPosition: number): Unassignable | null {
  if (role.id === role.guildId) return "everyone";
  if (role.managed) return "managed";
  if (role.position >= botTopPosition) return "aboveBot";
  if ((role.permissions & DANGEROUS_PERMISSIONS) !== 0n) return "dangerous";
  return null;
}
