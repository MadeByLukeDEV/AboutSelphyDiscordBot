import { Events, type Client } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { closeIdleTickets, noteTicketActivity, onTicketChannelDeleted, reconcileTickets } from "./service";

const IDLE_CHECK_MS = 10 * 60_000;

/** Keeps tickets in step with Discord: a ticket channel deleted by hand closes its ticket, and a restart cleans up. */
export function registerTicketEvents(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "tickets: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.on(Events.ChannelDelete, (channel) => {
    if (channel.isDMBased() || channel.guildId !== env().DISCORD_GUILD_ID) return;
    void onTicketChannelDeleted(channel.id).catch((err) => log.error({ err }, "ticket channel delete handler failed"));
  });
  // People writing in a ticket keep it alive (bots don't).
  client.on(Events.MessageCreate, (message) => {
    if (message.guildId !== env().DISCORD_GUILD_ID || message.author.bot || message.system) return;
    void noteTicketActivity(message.channelId).catch((err) => log.warn({ err }, "ticket activity handler failed"));
  });
  client.once(Events.ClientReady, () => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (guild) void reconcileTickets(guild).catch((err) => log.error({ err }, "ticket reconcile failed"));
    // Idle tickets: checked every ten minutes (it does nothing while the setting is 0).
    setInterval(() => {
      const g = client.guilds.cache.get(env().DISCORD_GUILD_ID);
      if (g) void closeIdleTickets(g).catch((err) => log.error({ err }, "closing idle tickets failed"));
    }, IDLE_CHECK_MS).unref();
  });
}
