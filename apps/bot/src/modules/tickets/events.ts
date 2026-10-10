import { Events, type Client } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { onTicketChannelDeleted, reconcileTickets } from "./service";

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
  client.once(Events.ClientReady, () => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (guild) void reconcileTickets(guild).catch((err) => log.error({ err }, "ticket reconcile failed"));
  });
}
