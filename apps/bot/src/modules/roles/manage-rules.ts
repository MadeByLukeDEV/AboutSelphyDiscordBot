import { DANGEROUS_PERMISSIONS } from "./safety";

// Which roles the role manager may delete. Pure, so the rule is testable. The decision is made
// again on the bot for every id, whatever the dashboard sent.

export type ManageFacts = { id: string; guildId: string; managed: boolean; position: number; permissions: bigint };
export type Protection = "managed" | "aboveBot" | "staff";

/**
 * Null when the role may be deleted. @everyone is never listed. A role managed by an
 * integration (a bot's own role, Nitro booster, a Twitch sub role) is deleted by removing
 * the integration, a role at or above the bot's top role can't be touched, and the roles
 * configured as staff in the environment must never disappear from the dashboard.
 */
export function protectionOf(role: ManageFacts, botTopPosition: number, staffRoleIds: ReadonlySet<string>): Protection | null {
  if (role.managed) return "managed";
  if (role.position >= botTopPosition) return "aboveBot";
  if (staffRoleIds.has(role.id)) return "staff";
  return null;
}

export const isPowerful = (permissions: bigint): boolean => (permissions & DANGEROUS_PERMISSIONS) !== 0n;
