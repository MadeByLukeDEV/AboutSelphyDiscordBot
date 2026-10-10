import { ChannelType, type Guild } from "discord.js";
import type { TempVoiceOverview, TempVoiceRoom } from "@aboutselphy/shared";
import { missingFor } from "./checks";
import { getTempVoiceConfig } from "./config";
import { stateFromChannel } from "./controller";
import { humansIn } from "./discord-channels";
import * as repo from "./repository";
import type { RoomState } from "./state";

const MAX_LISTED_MEMBERS = 25;

export type RoomSnapshot = {
  channelId: string;
  name: string;
  ownerId: string;
  ownerName: string | null;
  members: Array<{ id: string; name: string }>;
  state: RoomState;
  createdAt: Date;
};

/** Pure: the shape the dashboard receives. Caps the member list, keeps the real count. */
export function summarizeRoom(s: RoomSnapshot): TempVoiceRoom {
  return {
    channelId: s.channelId,
    name: s.name,
    ownerId: s.ownerId,
    ownerName: s.ownerName,
    memberCount: s.members.length,
    members: s.members.slice(0, MAX_LISTED_MEMBERS),
    locked: s.state.locked,
    userLimit: s.state.userLimit,
    videoAllowed: s.state.videoAllowed,
    soundboardAllowed: s.state.soundboardAllowed,
    allowedCount: s.state.allowedIds.length,
    blockedCount: s.state.blockedIds.length,
    createdAt: s.createdAt.toISOString(),
  };
}

/**
 * What the dashboard's live view shows: every room we know of that still exists,
 * read from the gateway cache (no REST call per room, so it's cheap to poll),
 * plus what the bot is missing to run rooms.
 */
export async function getTempVoiceOverview(guild: Guild): Promise<TempVoiceOverview> {
  const [rows, config] = await Promise.all([repo.listRooms(), getTempVoiceConfig()]);
  const me = guild.client.user.id;

  const rooms: TempVoiceRoom[] = [];
  for (const row of rows) {
    const channel = guild.channels.cache.get(row.channelId);
    if (channel?.type !== ChannelType.GuildVoice) continue; // stale row: the next reconcile removes it

    const owner = guild.members.cache.get(row.ownerId) ?? (await guild.members.fetch(row.ownerId).catch(() => null));
    rooms.push(
      summarizeRoom({
        channelId: row.channelId,
        name: channel.name,
        ownerId: row.ownerId,
        ownerName: owner?.displayName ?? null,
        members: [...humansIn(channel).values()].map((m) => ({ id: m.id, name: m.displayName })),
        state: stateFromChannel(channel, row.ownerId, me),
        createdAt: row.createdAt,
      }),
    );
  }

  const missingPermissions = config.lobbyChannelId ? await missingFor(guild, config.lobbyChannelId, config.categoryId) : [];
  return { missingPermissions, rooms };
}
