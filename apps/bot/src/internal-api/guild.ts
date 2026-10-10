import { ChannelType, type Guild } from "discord.js";
import type { ChannelKind, GuildChannel } from "@aboutselphy/shared";

/** Our three kinds -> Discord channel types. Announcement channels count as text. */
const KIND_OF: Partial<Record<ChannelType, ChannelKind>> = {
  [ChannelType.GuildText]: "text",
  [ChannelType.GuildAnnouncement]: "text",
  [ChannelType.GuildVoice]: "voice",
  [ChannelType.GuildCategory]: "category",
};

/** Inside a category Discord lists text channels first, then voice. */
const KIND_RANK: Record<ChannelKind, number> = { category: 0, text: 1, voice: 2 };

type ChannelLike = {
  id: string;
  name: string;
  type: ChannelType;
  parent?: { name: string; rawPosition?: number } | null;
  rawPosition?: number;
};

function compareIds(a: string, b: string): number {
  // Snowflakes are numeric; compare as BigInt so a longer ID is a larger ID.
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Pure mapping, so it can be tested without a Discord connection.
 *
 * The order is the one Discord's sidebar shows, so a picker matches what staff
 * see in the server:
 *  1. channels without a category come first, then each category by its position
 *  2. a category is listed before its own channels
 *  3. inside a category, text (and announcement) channels before voice channels
 *  4. then by position; equal positions fall back to the ID (Discord does too)
 */
export function mapChannels(channels: Iterable<ChannelLike>, kinds: ReadonlySet<ChannelKind>): GuildChannel[] {
  const entries: Array<{ channel: GuildChannel; group: number; rank: number; position: number }> = [];

  for (const c of channels) {
    const kind = KIND_OF[c.type];
    if (!kind || !kinds.has(kind)) continue;
    entries.push({
      channel: { id: c.id, name: c.name, kind, parent: c.parent?.name ?? null },
      // The category's own position decides where its block sits.
      group: kind === "category" ? (c.rawPosition ?? 0) : c.parent ? (c.parent.rawPosition ?? 0) : -1,
      rank: KIND_RANK[kind],
      position: c.rawPosition ?? 0,
    });
  }

  entries.sort(
    (a, b) =>
      a.group - b.group ||
      a.rank - b.rank ||
      a.position - b.position ||
      compareIds(a.channel.id, b.channel.id),
  );
  return entries.slice(0, 500).map((e) => e.channel);
}

export async function listGuildChannels(guild: Guild, kinds: ReadonlySet<ChannelKind>): Promise<GuildChannel[]> {
  const fetched = await guild.channels.fetch();
  return mapChannels(
    [...fetched.values()].filter((c): c is NonNullable<typeof c> => c !== null),
    kinds,
  );
}
