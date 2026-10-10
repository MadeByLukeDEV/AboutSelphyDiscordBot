import { ChannelType, type Guild, type GuildMember, type VoiceState } from "discord.js";
import type { TempVoiceConfig, TempVoiceLobby } from "@aboutselphy/db";
import { Cooldown } from "../../lib/cooldown";
import { env } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { getLobbies, getTempVoiceConfig } from "./config";
import { loadRoom, postPanel } from "./controller";
import { fetchVoiceChannel, humansIn } from "./discord-channels";
import { policyOf, renderRoomName } from "./name";
import { initialOverwrites } from "./permissions";
import * as repo from "./repository";
import { planTransition } from "./transition";

// Events for one room are handled one at a time (so "delete the empty room"
// can't race with "someone just joined"), and one member can't start two room
// creations at once.
const mutex = new KeyedMutex();
const createCooldown = new Cooldown(5000);
/** One "the owner left" notice per room per minute, so someone reconnecting over and over can't spam the chat. */
const ownerLeftCooldown = new Cooldown(60_000);

/** Channel IDs of the rooms we made. The database is the truth; this is its in-memory mirror. */
const rooms = new Set<string>();
let roomsLoaded = false;

async function ensureRoomsLoaded() {
  if (roomsLoaded) return;
  for (const row of await repo.listRooms()) rooms.add(row.channelId);
  roomsLoaded = true;
}

/** Forget a room: drop it from the mirror and the table. Safe to call twice. */
async function forget(channelId: string) {
  rooms.delete(channelId);
  await repo.deleteRoom(channelId);
}

export function isRoom(channelId: string): boolean {
  return rooms.has(channelId);
}

export function roomCount(): number {
  return rooms.size;
}

/** Entry point for every voice-state change in the server. */
export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (newState.guild.id !== env().DISCORD_GUILD_ID) return;
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  await ensureRoomsLoaded();
  const [config, lobbies] = await Promise.all([getTempVoiceConfig(), getLobbies()]);
  const plan = planTransition({
    oldChannelId: oldState.channelId,
    newChannelId: newState.channelId,
    enabled: config.enabled,
    lobbyChannelIds: new Set(lobbies.filter((l) => l.enabled).map((l) => l.channelId)),
    isRoom,
  });

  if (plan.checkEmpty) {
    const id = plan.checkEmpty;
    await mutex.run(`room:${id}`, () => deleteIfEmpty(newState.guild, id)).catch((err) => {
      log.error({ err, channel: id }, "could not check a temporary room for emptiness");
    });
    await notifyOwnerLeft(newState.guild, id, member.id).catch((err) => {
      log.warn({ err, channel: id }, "could not post the owner-left notice");
    });
  }
  const lobby = plan.createFromLobby ? lobbies.find((l) => l.channelId === plan.createFromLobby) : undefined;
  if (lobby) {
    await mutex.run(`user:${member.id}`, () => createRoomFor(member, lobby, config)).catch((err) => {
      // Most often a missing permission or a full category: say which, not just "failed".
      log.error({ err, member: member.id, lobby: lobby.channelId }, "could not create a temporary room (check the bot's Manage Channels and Move Members permissions, and that the category isn't full)");
    });
  }
}

/** Makes a room from `lobby`, using that lobby's own category, name, limit and defaults. */
async function createRoomFor(member: GuildMember, lobby: TempVoiceLobby, config: TempVoiceConfig): Promise<void> {
  const guild = member.guild;

  // One room per member, whichever lobby they use: joining a lobby again takes
  // them back to the room they already have.
  for (const row of await repo.findRoomsByOwner(member.id)) {
    const existing = await fetchVoiceChannel(guild, row.channelId);
    if (existing) {
      await member.voice.setChannel(existing, "Back to their temporary room").catch(() => undefined);
      log.info({ member: member.id, channel: existing.id }, "member sent back to their existing room");
      return;
    }
    await forget(row.channelId); // the channel is gone, the row is stale
  }

  if (!createCooldown.tryAcquire(member.id)) {
    log.info({ member: member.id }, "room creation skipped (cooldown)");
    return;
  }

  const lobbyChannel = await fetchVoiceChannel(guild, lobby.channelId);
  const name = renderRoomName(lobby.nameTemplate, member.displayName, policyOf(config));

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: lobby.categoryId ?? lobbyChannel?.parentId ?? null,
    userLimit: lobby.defaultUserLimit,
    permissionOverwrites: initialOverwrites({
      everyoneId: guild.id,
      ownerId: member.id,
      allowVideo: lobby.allowVideoByDefault,
      allowSoundboard: lobby.allowSoundboardByDefault,
    }),
    reason: `Temporary voice room for ${member.user.username}`,
  });

  try {
    await repo.insertRoom(channel.id, member.id, lobby.channelId);
    rooms.add(channel.id);
  } catch (err) {
    // Never leave a channel behind that we can't find again.
    await channel.delete("Could not record the temporary room").catch(() => undefined);
    throw err;
  }

  const moved = await member.voice
    .setChannel(channel, "Moved into their new temporary room")
    .then(() => true)
    .catch(() => false);
  if (!moved) {
    // They left the lobby in the meantime (or can't be moved): nobody is coming.
    await channel.delete("Owner left before being moved").catch(() => undefined);
    await forget(channel.id);
    log.info({ member: member.id }, "room removed again: the member left before being moved");
    return;
  }
  await postPanel({ channel, ownerId: member.id, panelMessageId: null });
  log.info({ member: member.id, channel: channel.id, lobby: lobby.channelId, name }, "temporary room created");
}

/**
 * Deletes a room once no human is left in it (a bot that stays behind doesn't
 * keep it alive). Never touches a channel that isn't one of ours, and never a
 * configured lobby, even if a row somehow points at one.
 */
async function deleteIfEmpty(guild: Guild, channelId: string): Promise<void> {
  if (!rooms.has(channelId)) return;

  const lobbies = await getLobbies();
  const channel = await fetchVoiceChannel(guild, channelId);
  if (!channel) {
    await forget(channelId);
    log.info({ channel: channelId }, "temporary room was already gone, row removed");
    return;
  }
  if (lobbies.some((l) => l.channelId === channelId)) {
    await forget(channelId);
    log.warn({ channel: channelId }, "a room row pointed at a lobby: row removed, channel kept");
    return;
  }

  if (humansIn(channel).size > 0) return;

  await channel.delete("Temporary voice room is empty");
  await forget(channelId);
  log.info({ channel: channelId }, "empty temporary room deleted");
}

/**
 * When a room's owner leaves but other people stay, say so in the room's chat:
 * the room isn't deleted (people are in it) and nobody can manage it until
 * someone claims it.
 */
async function notifyOwnerLeft(guild: Guild, channelId: string, memberId: string): Promise<void> {
  const room = await loadRoom(guild, channelId);
  if (!room || room.ownerId !== memberId) return;
  if (humansIn(room.channel).size === 0) return;
  if (!ownerLeftCooldown.tryAcquire(channelId)) return;
  await room.channel.send({
    content: `<@${memberId}> left the room. Anyone in here can take over with \`/voice claim\`.`,
    allowedMentions: { parse: [] },
  });
}

/**
 * Run at startup and after a gateway resume (events can be missed while
 * disconnected): reload the rooms from the database, then delete the ones that
 * emptied while the bot was away and forget the ones that no longer exist.
 */
export async function reconcileRooms(guild: Guild): Promise<void> {
  const stored = await repo.listRooms();
  rooms.clear();
  for (const row of stored) rooms.add(row.channelId);
  roomsLoaded = true;

  for (const row of stored) {
    await mutex.run(`room:${row.channelId}`, () => deleteIfEmpty(guild, row.channelId)).catch((err) => {
      log.error({ err, channel: row.channelId }, "could not reconcile a temporary room");
    });
  }
  log.info({ stored: stored.length, remaining: rooms.size }, "temporary rooms reconciled");
}

/** Someone deleted a room by hand: forget it. */
export async function onChannelDeleted(guildId: string, channelId: string): Promise<void> {
  if (guildId !== env().DISCORD_GUILD_ID || !rooms.has(channelId)) return;
  await forget(channelId);
  log.info({ channel: channelId }, "temporary room deleted outside the bot, row removed");
}
