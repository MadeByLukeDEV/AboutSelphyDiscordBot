import {
  ActionRowBuilder,
  ModalBuilder,
  OverwriteType,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type GuildMember,
  type VoiceChannel,
} from "discord.js";
import { escapeText } from "../../lib/escape";
import { log } from "../../lib/log";
import { staffLevel } from "../../lib/permissions";
import { SlidingWindowLimiter } from "../../lib/sliding-window";
import { getTempVoiceConfig } from "./config";
import { fetchVoiceChannel } from "./discord-channels";
import { checkRename, policyOf } from "./name";
import { buildPanel, panelId } from "./panel";
import * as repo from "./repository";
import {
  canClaimRoom,
  canManageRoom,
  checkTarget,
  deriveRoomState,
  TARGET_DENIAL_MESSAGES,
  type RoomState,
  type TargetAction,
} from "./state";

// Everything a member can do to their room lives here, and both the panel
// buttons and the /voice command call it. That keeps one rule set: each action
// checks who is asking before touching anything, and returns text for the
// member instead of throwing.

export type Room = { channel: VoiceChannel; ownerId: string; panelMessageId: string | null };
export type Outcome = { ok: true; message: string } | { ok: false; message: string };

const ok = (message: string): Outcome => ({ ok: true, message });
const no = (message: string): Outcome => ({ ok: false, message });

/** Discord allows 2 renames per channel per 10 minutes; past that, requests just queue. */
const renameLimiter = new SlidingWindowLimiter(2, 10 * 60 * 1000);
const MAX_TARGETS = 5;

// -- finding the room -----------------------------------------------------------

/** A room we made, or null if the channel isn't one (or no longer exists). */
export async function loadRoom(guild: Guild, channelId: string): Promise<Room | null> {
  const row = await repo.findRoom(channelId);
  if (!row) return null;
  const channel = await fetchVoiceChannel(guild, channelId);
  return channel ? { channel, ownerId: row.ownerId, panelMessageId: row.panelMessageId } : null;
}

/** The room the member is currently sitting in, if it's one of ours. */
export async function roomOfMember(member: GuildMember): Promise<Room | null> {
  const channelId = member.voice.channelId;
  return channelId ? loadRoom(member.guild, channelId) : null;
}

// -- state and panel --------------------------------------------------------------

/** The state of a channel as its permission overwrites and settings say it is (no network call). */
export function stateFromChannel(channel: VoiceChannel, ownerId: string, botId: string): RoomState {
  return deriveRoomState({
    overwrites: [...channel.permissionOverwrites.cache.values()].map((o) => ({
      id: o.id,
      kind: o.type === OverwriteType.Role ? ("role" as const) : ("member" as const),
      allow: o.allow.bitfield,
      deny: o.deny.bitfield,
    })),
    everyoneId: channel.guild.id,
    ownerId,
    botId,
    userLimit: channel.userLimit,
  });
}

/** The room's state, read from a freshly fetched channel so it includes the change just made. */
export async function roomState(room: Room): Promise<RoomState> {
  const channel = (await room.channel.fetch(true)) as VoiceChannel;
  return stateFromChannel(channel, room.ownerId, channel.client.user.id);
}

async function panelPayload(room: Room) {
  const state = await roomState(room);
  return { ...buildPanel({ channelId: room.channel.id, ownerId: room.ownerId, state }), allowedMentions: { parse: [] as never[] } };
}

/** Posts a new panel in the room's chat and remembers it. Never throws: a missing chat is not fatal. */
export async function postPanel(room: Room): Promise<void> {
  try {
    const message = await room.channel.send(await panelPayload(room));
    await repo.setPanelMessage(room.channel.id, message.id);
    room.panelMessageId = message.id;
  } catch (err) {
    log.warn({ err, channel: room.channel.id }, "could not post the room control panel");
  }
}

/** Re-renders the panel after a change (posting a new one if it was deleted). Never throws. */
export async function refreshPanel(room: Room): Promise<void> {
  try {
    if (room.panelMessageId) {
      const message = await room.channel.messages.fetch(room.panelMessageId).catch(() => null);
      if (message) {
        await message.edit(await panelPayload(room));
        return;
      }
    }
    await postPanel(room);
  } catch (err) {
    log.warn({ err, channel: room.channel.id }, "could not refresh the room control panel");
  }
}

// -- who is asking -----------------------------------------------------------------

function isStaff(member: GuildMember): boolean {
  return staffLevel(member) !== null;
}

/** null when allowed, otherwise the refusal to show. */
export function denyUnlessManager(room: Room, actor: GuildMember): Outcome | null {
  return canManageRoom({ userId: actor.id, ownerId: room.ownerId, isStaff: isStaff(actor) })
    ? null
    : no(`Only <@${room.ownerId}> can change this room.`);
}

const reasonFor = (actor: GuildMember) => `Room controls used by ${actor.user.username}`;

// -- simple settings ------------------------------------------------------------------

export async function renameRoom(room: Room, actor: GuildMember, requested: string): Promise<Outcome> {
  const denied = denyUnlessManager(room, actor);
  if (denied) return denied;

  const config = await getTempVoiceConfig();
  const check = checkRename(requested, policyOf(config));
  if (!check.ok) return no(check.reason === "empty" ? "That name is empty." : "That name isn't allowed here.");
  if (check.name === room.channel.name) return ok("The room already has that name.");

  if (!renameLimiter.tryAcquire(room.channel.id)) {
    const wait = renameLimiter.retryAfterSeconds(room.channel.id);
    return no(`Discord only allows 2 renames per 10 minutes. Try again in ${Math.ceil(wait / 60)} min.`);
  }
  await room.channel.setName(check.name, reasonFor(actor));
  await refreshPanel(room);
  return ok(`Renamed to **${escapeText(check.name)}**.`);
}

export async function setRoomLimit(room: Room, actor: GuildMember, limit: number): Promise<Outcome> {
  const denied = denyUnlessManager(room, actor);
  if (denied) return denied;
  if (!Number.isInteger(limit) || limit < 0 || limit > 99) return no("Pick a number from 0 to 99 (0 means no limit).");

  await room.channel.setUserLimit(limit, reasonFor(actor));
  await refreshPanel(room);
  return ok(limit === 0 ? "The room has no member limit now." : `The room now allows ${limit} members.`);
}

export async function setLocked(room: Room, actor: GuildMember, locked: boolean): Promise<Outcome> {
  const denied = denyUnlessManager(room, actor);
  if (denied) return denied;
  // Unlocking clears the override (null) instead of forcing "allow", so a
  // category that restricts who may connect keeps doing so.
  await room.channel.permissionOverwrites.edit(room.channel.guild.id, { Connect: locked ? false : null }, { reason: reasonFor(actor) });
  await refreshPanel(room);
  return ok(locked ? "The room is locked. Only people you let in can join." : "The room is open again.");
}

export async function setVideo(room: Room, actor: GuildMember, allowed: boolean): Promise<Outcome> {
  const denied = denyUnlessManager(room, actor);
  if (denied) return denied;
  await room.channel.permissionOverwrites.edit(room.channel.guild.id, { Stream: allowed }, { reason: reasonFor(actor) });
  await refreshPanel(room);
  return ok(allowed ? "Video and screen sharing are on." : "Video and screen sharing are off.");
}

export async function setSoundboard(room: Room, actor: GuildMember, allowed: boolean): Promise<Outcome> {
  const denied = denyUnlessManager(room, actor);
  if (denied) return denied;
  await room.channel.permissionOverwrites.edit(
    room.channel.guild.id,
    { UseSoundboard: allowed, UseExternalSounds: allowed },
    { reason: reasonFor(actor) },
  );
  await refreshPanel(room);
  return ok(allowed ? "The soundboard is on." : "The soundboard is off.");
}

// -- actions on other members -----------------------------------------------------------

/** Members by ID (REST, one by one: no privileged intent needed). People who aren't in the server are dropped. */
async function resolveMembers(guild: Guild, ids: readonly string[]): Promise<GuildMember[]> {
  const found = await Promise.all([...new Set(ids)].slice(0, MAX_TARGETS).map((id) => guild.members.fetch(id).catch(() => null)));
  return found.filter((m): m is GuildMember => m !== null);
}

/**
 * Runs `apply` for each target the rules allow and reports what happened per
 * person, so one refused target doesn't hide that the others went through.
 */
async function forEachTarget(
  room: Room,
  actor: GuildMember,
  action: TargetAction,
  ids: readonly string[],
  apply: (target: GuildMember) => Promise<string | null>,
): Promise<Outcome> {
  const denied = denyUnlessManager(room, actor);
  if (denied) return denied;

  const guild = room.channel.guild;
  const targets = await resolveMembers(guild, ids);
  if (targets.length === 0) return no("I couldn't find that person in the server.");

  const done: string[] = [];
  const skipped: string[] = [];
  for (const target of targets) {
    const check = checkTarget({
      action,
      actorId: actor.id,
      actorIsStaff: isStaff(actor),
      actorIsServerOwner: guild.ownerId === actor.id,
      targetId: target.id,
      targetIsBot: target.user.bot,
      targetIsStaff: isStaff(target),
      targetIsServerOwner: guild.ownerId === target.id,
      roomOwnerId: room.ownerId,
    });
    if (!check.ok) {
      skipped.push(`<@${target.id}>: ${TARGET_DENIAL_MESSAGES[check.reason]}`);
      continue;
    }
    const note = await apply(target);
    if (note === null) done.push(`<@${target.id}>`);
    else skipped.push(`<@${target.id}>: ${note}`);
  }

  await refreshPanel(room);
  const lines = [done.length ? `Done for ${done.join(", ")}.` : "", ...skipped.map((s) => `Skipped ${s}`)].filter(Boolean);
  return done.length > 0 ? ok(lines.join("\n")) : no(lines.join("\n"));
}

const inRoom = (room: Room, target: GuildMember) => target.voice.channelId === room.channel.id;

export function letIn(room: Room, actor: GuildMember, ids: readonly string[]): Promise<Outcome> {
  return forEachTarget(room, actor, "allow", ids, async (target) => {
    await room.channel.permissionOverwrites.edit(target.id, { ViewChannel: true, Connect: true }, { reason: reasonFor(actor) });
    return null;
  });
}

/** Takes someone off the allow-list or lifts a block: both just remove their overwrite. */
export function removeFromList(room: Room, actor: GuildMember, ids: readonly string[], action: "remove" | "unblock"): Promise<Outcome> {
  return forEachTarget(room, actor, action, ids, async (target) => {
    if (target.id === room.ownerId) return "that's the owner.";
    const existing = room.channel.permissionOverwrites.cache.get(target.id);
    if (!existing) return "they aren't on the list.";
    await room.channel.permissionOverwrites.delete(target.id, reasonFor(actor));
    return null;
  });
}

export function kickFromRoom(room: Room, actor: GuildMember, ids: readonly string[]): Promise<Outcome> {
  return forEachTarget(room, actor, "kick", ids, async (target) => {
    if (!inRoom(room, target)) return "they aren't in the room.";
    await target.voice.disconnect(reasonFor(actor));
    return null;
  });
}

export function blockFromRoom(room: Room, actor: GuildMember, ids: readonly string[]): Promise<Outcome> {
  return forEachTarget(room, actor, "block", ids, async (target) => {
    await room.channel.permissionOverwrites.edit(target.id, { Connect: false }, { reason: reasonFor(actor) });
    if (inRoom(room, target)) await target.voice.disconnect(reasonFor(actor));
    return null;
  });
}

async function makeOwner(room: Room, newOwner: GuildMember, actor: GuildMember): Promise<void> {
  await repo.setOwner(room.channel.id, newOwner.id);
  room.ownerId = newOwner.id;
  // The new owner can always get back into a locked room. The previous owner keeps
  // their entry, so handing a room over doesn't lock the old owner out.
  await room.channel.permissionOverwrites.edit(newOwner.id, { ViewChannel: true, Connect: true }, { reason: reasonFor(actor) });
  await refreshPanel(room);
  await room.channel.send({ content: `<@${newOwner.id}> is now the owner of this room.`, allowedMentions: { parse: [] } }).catch(() => undefined);
}

export async function transferRoom(room: Room, actor: GuildMember, targetId: string): Promise<Outcome> {
  const denied = denyUnlessManager(room, actor);
  if (denied) return denied;

  const [target] = await resolveMembers(room.channel.guild, [targetId]);
  if (!target) return no("I couldn't find that person in the server.");
  const check = checkTarget({
    action: "transfer",
    actorId: actor.id,
    actorIsStaff: isStaff(actor),
    actorIsServerOwner: room.channel.guild.ownerId === actor.id,
    targetId: target.id,
    targetIsBot: target.user.bot,
    targetIsStaff: isStaff(target),
    targetIsServerOwner: room.channel.guild.ownerId === target.id,
    roomOwnerId: room.ownerId,
  });
  if (!check.ok) return no(TARGET_DENIAL_MESSAGES[check.reason]);
  if (target.id === room.ownerId) return no("They already own this room.");
  if (!inRoom(room, target)) return no("They need to be in the room to take it over.");

  await makeOwner(room, target, actor);
  return ok(`<@${target.id}> owns the room now.`);
}

/** Take over a room whose owner has left. Staff sitting in the room may take over at any time. */
export async function claimRoom(room: Room, member: GuildMember): Promise<Outcome> {
  const userInRoom = inRoom(room, member);
  const ownerInRoom = room.channel.members.has(room.ownerId);
  const allowed =
    canClaimRoom({ userId: member.id, ownerId: room.ownerId, userInRoom, ownerInRoom }) ||
    (isStaff(member) && userInRoom && member.id !== room.ownerId);
  if (!allowed) {
    return no(
      member.id === room.ownerId
        ? "You already own this room."
        : !userInRoom
          ? "Join the room first."
          : `<@${room.ownerId}> is still here, so it isn't free to take.`,
    );
  }
  await makeOwner(room, member, member);
  return ok("You own the room now.");
}

// -- modals --------------------------------------------------------------------------------

export function renameModal(channelId: string, currentName: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(panelId("rename-modal", channelId))
    .setTitle("Rename your room")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("name")
          .setLabel("New name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setValue([...currentName].slice(0, 100).join("")),
      ),
    );
}

export function limitModal(channelId: string, current: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(panelId("limit-modal", channelId))
    .setTitle("Member limit")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("limit")
          .setLabel("How many members? (0 = no limit)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(2)
          .setValue(String(current)),
      ),
    );
}

/** "12" -> 12; anything else (empty, text, negatives, decimals, 100+) -> null. */
export function parseLimitInput(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,2}$/.test(trimmed) ? Number(trimmed) : null;
}
