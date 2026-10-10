import { Events, type Client, type Guild, type GuildTextBasedChannel } from "discord.js";
import type { StickyClearStatus } from "@aboutselphy/shared";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { findByChannel, listDirty, listStickies, setPosted } from "./repository";
import { buildStickyMessage, STICKY_DELAY_MS } from "./rules";

// Sticky messages. When someone writes in a channel that has one, the bot waits a moment, deletes its
// old copy and posts it again at the bottom. One channel at a time (KeyedMutex), and a change made
// in the dashboard (dirty) is posted right away. Only needs the GuildMessages intent: the text of
// other people's messages is never read.

const mutex = new KeyedMutex();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const TTL_MS = 60_000;
let cache: { channels: Set<string>; at: number } | undefined;

async function stickyChannels(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;
  const channels = new Set((await listStickies()).filter((s) => s.enabled).map((s) => s.channelId));
  cache = { channels, at: Date.now() };
  return channels;
}

async function textChannel(guild: Guild, channelId: string): Promise<GuildTextBasedChannel | null> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel && !channel.isDMBased() && channel.isTextBased() && "send" in channel ? (channel as GuildTextBasedChannel) : null;
}

/** Takes the old copy down and, if the sticky is on, posts a fresh one at the bottom. */
function refresh(guild: Guild, channelId: string): Promise<void> {
  return mutex.run(channelId, async () => {
    try {
      const row = await findByChannel(channelId);
      if (!row) return;
      const channel = await textChannel(guild, channelId);
      if (!channel) {
        log.warn({ channelId }, "sticky: the channel is missing or the bot can't post in it");
        return;
      }
      if (row.lastMessageId) await channel.messages.delete(row.lastMessageId).catch(() => undefined);
      if (!row.enabled) {
        await setPosted(row.id, null);
        return;
      }
      const sent = await channel.send(buildStickyMessage(row.content));
      await setPosted(row.id, sent.id);
      log.info({ channelId }, "sticky: posted");
    } catch (err) {
      log.warn({ err, channelId }, "sticky: could not refresh");
    }
  });
}

/** For the dashboard: take the current copy down before the row is removed. */
export async function clearSticky(guild: Guild, channelId: string): Promise<StickyClearStatus> {
  try {
    return await mutex.run(channelId, async () => {
      const row = await findByChannel(channelId);
      if (!row?.lastMessageId) return "done" as const;
      const channel = await textChannel(guild, channelId);
      if (channel) await channel.messages.delete(row.lastMessageId).catch(() => undefined);
      await setPosted(row.id, null);
      return "done" as const;
    });
  } catch (err) {
    log.warn({ err, channelId }, "sticky: could not clear");
    return "failed";
  }
}

async function postDirty(guild: Guild): Promise<void> {
  for (const row of await listDirty()) await refresh(guild, row.channelId);
}

/** Starts watching. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it posts in real channels). */
export function startSticky(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "sticky: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const guildOf = () => client.guilds.cache.get(env().DISCORD_GUILD_ID);

  client.on(Events.MessageCreate, (message) => {
    if (message.guildId !== env().DISCORD_GUILD_ID) return;
    if (message.author.id === client.user?.id) return; // our own copy
    void stickyChannels()
      .then((channels) => {
        if (!channels.has(message.channelId)) return;
        const guild = guildOf();
        if (!guild) return;
        clearTimeout(timers.get(message.channelId));
        timers.set(
          message.channelId,
          setTimeout(() => {
            timers.delete(message.channelId);
            void refresh(guild, message.channelId);
          }, STICKY_DELAY_MS),
        );
      })
      .catch((err) => log.warn({ err }, "sticky: message handler failed"));
  });

  onReload("sticky", () => {
    cache = undefined;
    const guild = guildOf();
    if (guild) void postDirty(guild);
  });
  client.once(Events.ClientReady, () => {
    const guild = guildOf();
    if (guild) void postDirty(guild);
  });
}

export function stopSticky(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}
