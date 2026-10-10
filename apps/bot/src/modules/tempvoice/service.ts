import {
  ChannelType,
  DiscordAPIError,
  type Guild,
  type GuildMember,
  type VoiceChannel,
  type VoiceState,
} from "discord.js";
import type { TempVoiceConfig } from "@aboutselphy/db";
import { Cooldown } from "../../lib/cooldown";
import { env } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { getTempVoiceConfig } from "./config";
import { renderRoomName } from "./name";
import { initialOverwrites } from "./permissions";
import * as repo from "./repository";
import { planTransition } from "./transition";

// Events for one room are handled one at a time (so "delete the empty room"
// can't race with "someone just joined"), and one member can't start two room
// creations at once.
const mutex = new KeyedMutex();
const createCooldown = new Cooldown(5000);

/** Channel IDs of the rooms we made. The database is the truth; this is its in-memory mirror. */
const rooms = new Set<string>();
let roomsLoaded = false;

const UNKNOWN_CHANNEL = 10003;

async function ensureRoomsLoaded() {
  if (roomsLoaded) return;
  for (const row of await repo.listRooms()) rooms.add(row.channelId);
  roomsLoaded = true;
}

/** The voice channel with this ID, or null if it doesn't exist (any other error is thrown). */
async function fetchVoiceChannel(guild: Guild, channelId: string): Promise<VoiceChannel | null> {
  const found =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch((err: unknown) => {
      if (err instanceof DiscordAPIError && err.code === UNKNOWN_CHANNEL) return null;
      throw err;
    }));
  return found?.type === ChannelType.GuildVoice ? found : null;
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
  const config = await getTempVoiceConfig();
  const plan = planTransition({
    oldChannelId: oldState.channelId,
    newChannelId: newState.channelId,
    enabled: config.enabled,
    lobbyChannelId: config.lobbyChannelId,
    isRoom,
  });

  if (plan.checkEmpty) {
    const id = plan.checkEmpty;
    await mutex.run(`room:${id}`, () => deleteIfEmpty(newState.guild, id)).catch((err) => {
      log.error({ err, channel: id }, "could not check a temporary room for emptiness");
    });
  }
  if (plan.createRoom) {
    await mutex.run(`user:${member.id}`, () => createRoomFor(member, config)).catch((err) => {
      // Most often a missing permission or a full category: say which, not just "failed".
      log.error({ err, member: member.id }, "could not create a temporary room (check the bot's Manage Channels and Move Members permissions, and that the category isn't full)");
    });
  }
}

async function createRoomFor(member: GuildMember, config: TempVoiceConfig): Promise<void> {
  const guild = member.guild;
  if (!config.lobbyChannelId) return;

  // One room per member: joining the lobby again takes them back to theirs.
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

  const lobby = await fetchVoiceChannel(guild, config.lobbyChannelId);
  const name = renderRoomName(config.nameTemplate, member.displayName, config.blockedWords);

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: config.categoryId ?? lobby?.parentId ?? null,
    userLimit: config.defaultUserLimit,
    permissionOverwrites: initialOverwrites({
      everyoneId: guild.id,
      ownerId: member.id,
      allowVideo: config.allowVideoByDefault,
      allowSoundboard: config.allowSoundboardByDefault,
    }),
    reason: `Temporary voice room for ${member.user.username}`,
  });

  try {
    await repo.insertRoom(channel.id, member.id);
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
  log.info({ member: member.id, channel: channel.id, name }, "temporary room created");
}

/**
 * Deletes a room once no human is left in it (a bot that stays behind doesn't
 * keep it alive). Never touches a channel that isn't one of ours, and never the
 * configured lobby, even if a row somehow points at it.
 */
async function deleteIfEmpty(guild: Guild, channelId: string): Promise<void> {
  if (!rooms.has(channelId)) return;

  const config = await getTempVoiceConfig();
  const channel = await fetchVoiceChannel(guild, channelId);
  if (!channel) {
    await forget(channelId);
    log.info({ channel: channelId }, "temporary room was already gone, row removed");
    return;
  }
  if (channelId === config.lobbyChannelId) {
    await forget(channelId);
    log.warn({ channel: channelId }, "a room row pointed at the lobby: row removed, channel kept");
    return;
  }

  const humans = channel.members.filter((m) => !m.user.bot).size;
  if (humans > 0) return;

  await channel.delete("Temporary voice room is empty");
  await forget(channelId);
  log.info({ channel: channelId }, "empty temporary room deleted");
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
