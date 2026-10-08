import { Events, type Client } from "discord.js";
import { env } from "../lib/env";
import { log } from "../lib/log";

/** Ready / guild / connection logging. The bot only ever serves one guild. */
export function registerLifecycle(client: Client) {
  const guildId = env().DISCORD_GUILD_ID;

  client.once(Events.ClientReady, async (ready) => {
    log.info({ tag: ready.user.tag, guilds: ready.guilds.cache.size }, "gateway ready");
    // Leave any server that isn't ours (e.g. someone re-using the invite link).
    for (const guild of ready.guilds.cache.values()) {
      if (guild.id !== guildId) {
        log.warn({ guild: guild.id }, "leaving unknown guild");
        await guild.leave().catch((err) => log.error({ err }, "leave failed"));
      }
    }
    if (!ready.guilds.cache.has(guildId)) {
      log.error({ guild: guildId }, "bot is not a member of DISCORD_GUILD_ID, invite it first");
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    if (guild.id === guildId) return;
    log.warn({ guild: guild.id }, "added to unknown guild, leaving");
    await guild.leave().catch((err) => log.error({ err }, "leave failed"));
  });

  client.on(Events.Error, (err) => log.error({ err }, "client error"));
  client.on(Events.Warn, (message) => log.warn(message));
  client.on(Events.ShardDisconnect, (event, id) => log.warn({ shard: id, code: event.code }, "shard disconnected"));
  client.on(Events.ShardReconnecting, (id) => log.info({ shard: id }, "shard reconnecting"));
  client.on(Events.ShardResume, (id, replayed) => log.info({ shard: id, replayed }, "shard resumed"));
}
