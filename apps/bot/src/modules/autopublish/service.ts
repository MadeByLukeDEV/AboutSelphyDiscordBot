import { ChannelType, Events, MessageFlags, type Client } from "discord.js";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import { listPublishChannels } from "./repository";

// Auto-publish. Every message in a chosen announcement channel is published (crossposted) to the
// servers that follow it. Needs the bot's Manage Messages there for other people's messages. Discord
// allows 10 crossposts per hour per channel; a refusal is logged and the message stays unpublished.

const TTL_MS = 60_000;
let cache: { channels: Set<string>; at: number } | undefined;

async function publishChannels(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;
  cache = { channels: new Set(await listPublishChannels()), at: Date.now() };
  return cache.channels;
}

/** Starts watching. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it publishes real messages). */
export function startAutoPublish(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "auto-publish: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  onReload("autopublish", () => {
    cache = undefined;
  });
  client.on(Events.MessageCreate, (message) => {
    if (message.guildId !== env().DISCORD_GUILD_ID || message.channel.type !== ChannelType.GuildAnnouncement) return;
    void (async () => {
      if (!(await publishChannels()).has(message.channelId) || !(await moduleOn("autopublish"))) return;
      if (message.flags.has(MessageFlags.Crossposted) || message.system) return;
      if (!message.crosspostable) {
        log.warn({ channelId: message.channelId }, "auto-publish: the bot can't publish this message (missing Manage Messages?)");
        return;
      }
      await message.crosspost();
      log.info({ channelId: message.channelId, message: message.id }, "auto-publish: published");
    })().catch((err) => log.warn({ err, channelId: message.channelId }, "auto-publish: could not publish"));
  });
}
