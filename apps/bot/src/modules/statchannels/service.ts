import { ChannelType, Events, PermissionFlagsBits, type Client, type Guild } from "discord.js";
import type { StatKind } from "@aboutselphy/shared/stat-channels";
import { renderStatName } from "@aboutselphy/shared/stat-channels";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import { deleteByChannel, listStatChannels, rememberName } from "./repository";

// Stat channels. A round every 10 minutes (Discord allows two renames per channel per 10 minutes,
// so one per round is safe) and whenever the dashboard changes the list. A channel is only renamed
// when its name really differs, so a quiet server causes no API calls.

const INTERVAL_MS = 10 * 60_000;
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** The number a kind shows. Humans and bots need the full member list, which is fetched once per round. */
export function statValue(guild: Guild, kind: StatKind): number {
  switch (kind) {
    case "members":
      return guild.memberCount;
    case "humans":
      return guild.members.cache.filter((m) => !m.user.bot).size;
    case "bots":
      return guild.members.cache.filter((m) => m.user.bot).size;
    case "boosts":
      return guild.premiumSubscriptionCount ?? 0;
    case "channels":
      return guild.channels.cache.filter((c) => !c.isThread()).size;
    case "roles":
      return Math.max(0, guild.roles.cache.size - 1); // @everyone doesn't count
    case "voice":
      return guild.voiceStates.cache.filter((v) => v.channelId !== null && !v.member?.user.bot).size;
  }
}

export async function updateStatChannels(guild: Guild): Promise<void> {
  if (running) return;
  if (!(await moduleOn("statchannels"))) return;
  running = true;
  try {
    const rows = await listStatChannels();
    if (rows.length === 0) return;
    if (rows.some((r) => r.kind === "humans" || r.kind === "bots")) await guild.members.fetch().catch((err) => log.warn({ err }, "stat channels: could not load all members"));
    const me = guild.members.me ?? (await guild.members.fetchMe());
    for (const row of rows) {
      const channel = await guild.channels.fetch(row.channelId).catch(() => null);
      if (!channel) {
        log.warn({ channelId: row.channelId }, "stat channels: the channel is gone, forgetting it");
        await deleteByChannel(row.channelId);
        continue;
      }
      if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
        log.warn({ channelId: row.channelId }, "stat channels: not a voice channel, skipped");
        continue;
      }
      if (!channel.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
        log.warn({ channelId: row.channelId }, "stat channels: the bot lacks Manage Channels there, skipped");
        continue;
      }
      const name = renderStatName(row.template, statValue(guild, row.kind as StatKind));
      if (!name || channel.name === name) continue;
      try {
        await channel.setName(name, "Stat channel");
        await rememberName(row.id, name);
        log.info({ channelId: row.channelId, kind: row.kind }, "stat channels: renamed");
      } catch (err) {
        log.warn({ err, channelId: row.channelId }, "stat channels: could not rename");
      }
    }
  } catch (err) {
    log.error({ err }, "stat channel round failed");
  } finally {
    running = false;
  }
}

/** Starts the rounds with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it renames real channels). */
export function startStatChannels(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "stat channels: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const run = () => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (guild) void updateStatChannels(guild);
  };
  onReload("statchannels", run);
  client.once(Events.ClientReady, () => {
    run();
    timer = setInterval(run, INTERVAL_MS);
  });
}

export function stopStatChannels(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
