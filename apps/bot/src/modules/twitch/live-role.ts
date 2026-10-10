import type { Client } from "discord.js";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { checkRole } from "../roles";
import { readConfig } from "./repository";

// The "Live" role: while a configured channel is live, the streamer's linked Discord member wears
// the configured role; when the stream ends (or the channel is paused or removed) it is taken off.
// Every change goes through checkRole first, like every other role the bot hands out.

type Linked = { discordUserId: string | null; login: string };

/** Gives or takes the live role. Never throws: a failure is logged and the announcement goes on. */
export async function syncLiveRole(discord: Client | undefined, streamer: Linked, live: boolean): Promise<void> {
  try {
    if (!streamer.discordUserId) return;
    const config = await readConfig();
    if (!config.liveRoleId) return;
    const guild = discord?.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return;
    if (checkRole(guild, config.liveRoleId) !== "ok") {
      log.warn({ roleId: config.liveRoleId }, "twitch: the live role can't be handed out (missing, too high or too powerful)");
      return;
    }
    const member = await guild.members.fetch(streamer.discordUserId).catch(() => null);
    if (!member) {
      log.warn({ login: streamer.login, user: streamer.discordUserId }, "twitch: the linked Discord member is not in the server");
      return;
    }
    const has = member.roles.cache.has(config.liveRoleId);
    if (live && !has) {
      await member.roles.add(config.liveRoleId, `Live on Twitch (${streamer.login})`);
      log.info({ login: streamer.login, user: member.id }, "twitch: live role given");
    } else if (!live && has) {
      await member.roles.remove(config.liveRoleId, `Twitch stream ended (${streamer.login})`);
      log.info({ login: streamer.login, user: member.id }, "twitch: live role removed");
    }
  } catch (err) {
    log.warn({ err, login: streamer.login }, "twitch: could not update the live role");
  }
}
