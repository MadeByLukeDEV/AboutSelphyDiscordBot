import { ChannelType, DiscordAPIError, type Guild, type VoiceChannel } from "discord.js";

const UNKNOWN_CHANNEL = 10003;

/** The voice channel with this ID, or null if it doesn't exist (any other error is thrown). */
export async function fetchVoiceChannel(guild: Guild, channelId: string): Promise<VoiceChannel | null> {
  const found =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch((err: unknown) => {
      if (err instanceof DiscordAPIError && err.code === UNKNOWN_CHANNEL) return null;
      throw err;
    }));
  return found?.type === ChannelType.GuildVoice ? found : null;
}

/** Members in the channel who are people (a bot left behind doesn't count as company). */
export function humansIn(channel: VoiceChannel) {
  return channel.members.filter((m) => !m.user.bot);
}
