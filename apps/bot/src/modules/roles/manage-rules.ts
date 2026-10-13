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

export type MergeCheck = { ok: true } | { ok: false; reason: "target-invalid" | "source-invalid" };

/**
 * May these roles be merged? The target is handed to many members, so it must be a role the bot
 * could hand out anyway (no special permissions, below the bot, not managed, not @everyone) and
 * must not be a staff role (a merge must never grant dashboard rights). Sources are only read;
 * @everyone and the target itself are refused as sources.
 */
export function checkMerge(
  input: { sourceIds: string[]; targetId: string; guildId: string },
  target: { assignable: boolean } | null,
  staffRoleIds: ReadonlySet<string>,
): MergeCheck {
  if (!target || !target.assignable || staffRoleIds.has(input.targetId)) return { ok: false, reason: "target-invalid" };
  if (input.sourceIds.some((id) => id === input.targetId || id === input.guildId)) return { ok: false, reason: "source-invalid" };
  return { ok: true };
}

/**
 * Where a role lands when moved one place. Up needs room below the bot's own top role (the bot can't place a role at or above itself),
 * down needs a place above @everyone (position 0). Null = it is already at that edge.
 */
export function planMove(position: number, direction: "up" | "down", botTopPosition: number): number | null {
  const next = direction === "up" ? position + 1 : position - 1;
  if (next < 1 || next >= botTopPosition) return null;
  return next;
}

export type CopyCheck = { ok: true } | { ok: false; reason: "source-powerful" | "same" };

/**
 * May the permissions of `source` be copied to `target`? A copy must never hand out power: a source with Administrator, Manage* , Kick,
 * Ban, Timeout, Mention Everyone and the like is refused, so copying can't make a role (that many members hold) more dangerous.
 */
export function checkCopy(sourceId: string, targetId: string, sourcePermissions: bigint): CopyCheck {
  if (sourceId === targetId) return { ok: false, reason: "same" };
  if (isPowerful(sourcePermissions)) return { ok: false, reason: "source-powerful" };
  return { ok: true };
}
