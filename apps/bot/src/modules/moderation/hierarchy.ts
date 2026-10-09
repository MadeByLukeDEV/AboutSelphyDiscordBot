export type HierarchyInput = {
  actorId: string;
  targetId: string;
  botId: string;
  ownerId: string;
  /** Highest role position of the moderator. */
  actorPosition: number;
  /** Highest role position of the target, or null when they're not in the server (ban/unban by ID). */
  targetPosition: number | null;
  /** Highest role position of the bot. */
  botPosition: number;
};

export type HierarchyDenial = "self" | "bot" | "owner" | "actor_hierarchy" | "bot_hierarchy";
export type HierarchyResult = { ok: true } | { ok: false; reason: HierarchyDenial };

/**
 * Who may act on whom. Discord's own checks only cover the bot's side, so the
 * moderator's side is enforced here, on every call:
 *  - never yourself, the bot, or the server owner
 *  - the moderator's highest role must be above the target's (the owner may
 *    act on anyone)
 *  - the bot's highest role must be above the target's
 */
export function checkHierarchy(i: HierarchyInput): HierarchyResult {
  if (i.targetId === i.actorId) return { ok: false, reason: "self" };
  if (i.targetId === i.botId) return { ok: false, reason: "bot" };
  if (i.targetId === i.ownerId) return { ok: false, reason: "owner" };

  if (i.targetPosition !== null) {
    if (i.actorId !== i.ownerId && i.actorPosition <= i.targetPosition) {
      return { ok: false, reason: "actor_hierarchy" };
    }
    if (i.botPosition <= i.targetPosition) return { ok: false, reason: "bot_hierarchy" };
  }
  return { ok: true };
}

export const DENIAL_MESSAGES: Record<HierarchyDenial, string> = {
  self: "You can't do that to yourself.",
  bot: "I won't do that to myself.",
  owner: "You can't do that to the server owner.",
  actor_hierarchy: "That member has the same or a higher role than you.",
  bot_hierarchy: "That member has the same or a higher role than me. Move my role above theirs first.",
};
