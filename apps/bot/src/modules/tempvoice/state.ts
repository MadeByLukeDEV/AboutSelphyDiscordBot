import { PermissionFlagsBits as P } from "discord.js";

/** A permission overwrite reduced to what we read; bitfields are plain bigints. */
export type OverwriteBits = { id: string; kind: "role" | "member"; allow: bigint; deny: bigint };

export type RoomState = {
  /** @everyone can't connect. */
  locked: boolean;
  videoAllowed: boolean;
  soundboardAllowed: boolean;
  /** 0 = no limit. */
  userLimit: number;
  /** Members explicitly let in (matters while the room is locked). */
  allowedIds: string[];
  /** Members who may not join. */
  blockedIds: string[];
};

const has = (bits: bigint, flag: bigint) => (bits & flag) === flag;

/**
 * The room's state as the permission overwrites on the Discord channel say it
 * is. The channel is the single source of truth, so the panel can never show
 * something that differs from what members actually experience.
 *
 * The owner and the bot hold their own overwrites for practical reasons
 * (getting back into a locked room), so they are left out of the lists.
 */
export function deriveRoomState(input: {
  overwrites: readonly OverwriteBits[];
  everyoneId: string;
  ownerId: string;
  botId: string;
  userLimit: number;
}): RoomState {
  const everyone = input.overwrites.find((o) => o.kind === "role" && o.id === input.everyoneId);
  const members = input.overwrites.filter((o) => o.kind === "member" && o.id !== input.ownerId && o.id !== input.botId);

  return {
    locked: everyone ? has(everyone.deny, P.Connect) : false,
    // Not denied = allowed: an untouched channel inherits, and the default is on.
    videoAllowed: everyone ? !has(everyone.deny, P.Stream) : true,
    soundboardAllowed: everyone ? !has(everyone.deny, P.UseSoundboard) : true,
    userLimit: input.userLimit,
    allowedIds: members.filter((o) => has(o.allow, P.Connect)).map((o) => o.id),
    blockedIds: members.filter((o) => has(o.deny, P.Connect)).map((o) => o.id),
  };
}

// -- who may do what ----------------------------------------------------------

/** The owner manages their room; staff (moderators and admins) can manage any room. */
export function canManageRoom(i: { userId: string; ownerId: string; isStaff: boolean }): boolean {
  return i.userId === i.ownerId || i.isStaff;
}

/**
 * Taking over a room: only someone sitting in it, and only while the owner is
 * not. Otherwise "claim" would be a way to steal a room from its owner.
 */
export function canClaimRoom(i: { userId: string; ownerId: string; userInRoom: boolean; ownerInRoom: boolean }): boolean {
  return i.userInRoom && !i.ownerInRoom && i.userId !== i.ownerId;
}

export type TargetAction = "allow" | "remove" | "kick" | "block" | "unblock" | "transfer";
export type TargetDenial = "self" | "owner" | "staff" | "serverOwner" | "bot";

export type TargetCheck = { ok: true } | { ok: false; reason: TargetDenial };

/**
 * Whether the actor may do `action` to this member. The room owner can't be
 * used against moderators, the server owner or themselves; staff acting on a
 * room are exempt from the owner/staff protections but never against the
 * server owner.
 */
export function checkTarget(i: {
  action: TargetAction;
  actorId: string;
  actorIsStaff: boolean;
  actorIsServerOwner: boolean;
  targetId: string;
  targetIsBot: boolean;
  targetIsStaff: boolean;
  targetIsServerOwner: boolean;
  roomOwnerId: string;
}): TargetCheck {
  const harsh = i.action === "kick" || i.action === "block";

  if (i.action === "transfer" && i.targetIsBot) return { ok: false, reason: "bot" };
  if ((harsh || i.action === "transfer") && i.targetId === i.actorId) return { ok: false, reason: "self" };
  if (harsh && i.targetIsServerOwner && !i.actorIsServerOwner) return { ok: false, reason: "serverOwner" };
  if (harsh && !i.actorIsStaff) {
    if (i.targetId === i.roomOwnerId) return { ok: false, reason: "owner" };
    if (i.targetIsStaff) return { ok: false, reason: "staff" };
  }
  return { ok: true };
}

export const TARGET_DENIAL_MESSAGES: Record<TargetDenial, string> = {
  self: "You can't do that to yourself.",
  owner: "That's the room's owner.",
  staff: "You can't do that to a moderator.",
  serverOwner: "You can't do that to the server owner.",
  bot: "That has to be a person, not a bot.",
};
