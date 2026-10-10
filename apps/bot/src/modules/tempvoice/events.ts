import { Events, type Client } from "discord.js";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { registerRoomComponents } from "./interactions";
import { onChannelDeleted, onVoiceStateUpdate, reconcileRooms } from "./service";

/** Needs the GuildVoiceStates intent. */
export function registerTempVoice(client: Client) {
  registerRoomComponents();

  const reconcile = async (reason: string) => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return;
    log.info({ reason }, "reconciling temporary rooms");
    await reconcileRooms(guild).catch((err) => log.error({ err }, "temporary room reconcile failed"));
  };

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    void onVoiceStateUpdate(oldState, newState).catch((err) => log.error({ err }, "voice state handler failed"));
  });

  client.on(Events.ChannelDelete, (channel) => {
    if (channel.isDMBased()) return;
    void onChannelDeleted(channel.guildId, channel.id).catch((err) => log.error({ err }, "channel delete handler failed"));
  });

  client.once(Events.ClientReady, () => void reconcile("ready"));
  // Voice events can be missed while the connection was down.
  client.on(Events.ShardResume, () => void reconcile("resume"));
}
