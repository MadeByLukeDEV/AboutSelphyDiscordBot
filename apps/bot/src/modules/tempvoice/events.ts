import { Events, type Client } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { moduleOn } from "../../lib/modules";
import { log } from "../../lib/log";
import { getTempVoiceConfig } from "./config";
import { registerRoomComponents } from "./interactions";
import { planAfk } from "./roles";
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

  // The AFK mover: members who stay self-deafened for the configured time are moved to the server's AFK channel.
  // It moves real members, so it only runs in production (or with BOT_INTEGRATIONS_IN_DEV).
  const deafSince = new Map<string, number>();
  const afkRound = async () => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild || !(await moduleOn("tempvoice"))) return;
    const { afkMoveMinutes } = await getTempVoiceConfig();
    if (afkMoveMinutes <= 0 || !guild.afkChannelId) return void deafSince.clear();
    const voice = [...guild.voiceStates.cache.values()]
      .filter((s) => s.channelId && s.member && !s.member.user.bot)
      .map((s) => ({ userId: s.id, deafened: s.selfDeaf === true, inAfkChannel: s.channelId === guild.afkChannelId }));
    for (const userId of planAfk(deafSince, voice, Date.now(), afkMoveMinutes)) {
      const member = guild.members.cache.get(userId);
      if (!member?.voice.channelId) continue;
      await member.voice
        .setChannel(guild.afkChannelId, `Deafened for ${afkMoveMinutes} minutes`)
        .then(() => log.info({ user: userId, minutes: afkMoveMinutes }, "voice: moved a deafened member to the AFK channel"))
        .catch((err) => log.warn({ err, user: userId }, "voice: could not move a deafened member (needs Move Members)"));
    }
  };

  client.once(Events.ClientReady, () => {
    void reconcile("ready");
    if (!integrationsActive()) return void log.info({}, "voice: AFK mover not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    setInterval(() => void afkRound().catch((err) => log.error({ err }, "AFK round failed")), 60_000).unref();
  });
  // Voice events can be missed while the connection was down.
  client.on(Events.ShardResume, () => void reconcile("resume"));
}
