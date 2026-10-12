import { Events, type Client, type Guild, type GuildMember } from "discord.js";
import type { TwitchVipUnlinkStatus } from "@aboutselphy/shared";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { checkRole } from "../roles";
import { fetchChannelVips } from "../twitch";
import { dropVipConfig, getVipConfig } from "./config";
import { deleteByDiscord, deleteLink, findById, listApproved, recordSync } from "./repository";
import { planVipRoles } from "./rules";

// The Twitch VIP role. Every 10 minutes (and when the dashboard changes something) the bot reads the VIP list
// of the connected channel and gives the configured role to the members whose approved link points at a VIP,
// and takes it from the ones whose link no longer does. A failed read changes nothing: a Twitch hiccup must
// never strip anybody's role. Only linked members are managed; every role change goes through checkRole.

const INTERVAL_MS = 10 * 60_000;
const mutex = new KeyedMutex();
let timer: ReturnType<typeof setInterval> | undefined;

export function syncVipRole(guild: Guild): Promise<void> {
  return mutex.run("sync", async () => {
    try {
      const config = await getVipConfig();
      if (!config.enabled || !config.roleId) return;
      if (checkRole(guild, config.roleId) !== "ok") {
        log.warn({ roleId: config.roleId }, "twitchvip: the role can't be handed out (missing, too high or too powerful)");
        await recordSync("unavailable", config.vipCount);
        return;
      }
      const fetched = await fetchChannelVips();
      if (fetched.status !== "ok") {
        log.warn({ status: fetched.status }, "twitchvip: could not read the VIP list, nothing changed");
        await recordSync(fetched.status, config.vipCount);
        return;
      }

      const links = await listApproved();
      const holders = new Set<string>();
      const members = new Map<string, GuildMember>();
      for (const link of links) {
        const member = await guild.members.fetch(link.discordUserId).catch(() => null);
        if (!member) continue; // left the server: the leave handler forgets the link
        members.set(link.discordUserId, member);
        if (member.roles.cache.has(config.roleId)) holders.add(link.discordUserId);
      }
      const plan = planVipRoles(
        links.filter((l) => members.has(l.discordUserId)),
        new Set(fetched.vips.map((v) => v.id)),
        holders,
      );
      for (const id of plan.give) {
        await members.get(id)!.roles.add(config.roleId, "Twitch VIP").catch((err) => log.warn({ err, user: id }, "twitchvip: could not give the role"));
      }
      for (const id of plan.take) {
        await members.get(id)!.roles.remove(config.roleId, "No longer a Twitch VIP").catch((err) => log.warn({ err, user: id }, "twitchvip: could not take the role"));
      }
      await recordSync("ok", fetched.vips.length);
      log.info({ vips: fetched.vips.length, linked: links.length, given: plan.give.length, taken: plan.take.length }, "twitchvip: synced");
    } catch (err) {
      log.error({ err }, "twitchvip: sync failed");
    }
  });
}

/** Takes the role off one link's member (if the role is configured) and forgets the link. For the dashboard and /vip unlink. */
export async function unlinkVip(guild: Guild, id: string): Promise<TwitchVipUnlinkStatus> {
  try {
    const link = await findById(id);
    if (!link) return "done";
    const config = await getVipConfig();
    if (config.roleId && checkRole(guild, config.roleId) === "ok") {
      const member = await guild.members.fetch(link.discordUserId).catch(() => null);
      if (member?.roles.cache.has(config.roleId)) await member.roles.remove(config.roleId, "Twitch link removed");
    }
    await deleteLink(id);
    return "done";
  } catch (err) {
    log.warn({ err, id }, "twitchvip: could not unlink");
    return "failed";
  }
}

/** Starts the sync with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it changes roles of real members). */
export function startTwitchVip(client: Client): void {
  // A member who leaves takes their link with them (personal data).
  client.on(Events.GuildMemberRemove, (member) => {
    if (member.guild.id !== env().DISCORD_GUILD_ID) return;
    void deleteByDiscord(member.id).catch((err) => log.warn({ err }, "twitchvip: could not forget a member who left"));
  });
  if (!integrationsActive()) {
    log.info({}, "twitchvip: not syncing (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const run = () => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (guild) void syncVipRole(guild);
  };
  onReload("twitchvip", () => {
    dropVipConfig();
    run();
  });
  client.once(Events.ClientReady, () => {
    // After the Twitch connection had a moment to come up.
    setTimeout(run, 20_000).unref();
    timer = setInterval(run, INTERVAL_MS);
    timer.unref();
  });
}

export function stopTwitchVip(): void {
  clearInterval(timer);
  timer = undefined;
}
