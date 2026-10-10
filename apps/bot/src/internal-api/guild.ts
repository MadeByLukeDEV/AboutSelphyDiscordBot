import { ChannelType, type Guild } from "discord.js";
import type { ChannelKind, GuildChannel } from "@aboutselphy/shared";

/** Our three kinds -> Discord channel types. Announcement channels count as text. */
const KIND_OF: Partial<Record<ChannelType, ChannelKind>> = {
  [ChannelType.GuildText]: "text",
  [ChannelType.GuildAnnouncement]: "text",
  [ChannelType.GuildVoice]: "voice",
  [ChannelType.GuildCategory]: "category",
};

type ChannelLike = { id: string; name: string; type: ChannelType; parent?: { name: string } | null; rawPosition?: number };

/** Pure mapping, so it can be tested without a Discord connection. */
export function mapChannels(channels: Iterable<ChannelLike>, kinds: ReadonlySet<ChannelKind>): GuildChannel[] {
  const result: Array<GuildChannel & { position: number }> = [];
  for (const c of channels) {
    const kind = KIND_OF[c.type];
    if (!kind || !kinds.has(kind)) continue;
    result.push({ id: c.id, name: c.name, kind, parent: c.parent?.name ?? null, position: c.rawPosition ?? 0 });
  }
  // Group by category, then by the order shown in Discord.
  result.sort((a, b) => (a.parent ?? "").localeCompare(b.parent ?? "") || a.position - b.position);
  return result.slice(0, 500).map(({ position: _position, ...channel }) => channel);
}

export async function listGuildChannels(guild: Guild, kinds: ReadonlySet<ChannelKind>): Promise<GuildChannel[]> {
  const fetched = await guild.channels.fetch();
  return mapChannels(
    [...fetched.values()].filter((c): c is NonNullable<typeof c> => c !== null),
    kinds,
  );
}
