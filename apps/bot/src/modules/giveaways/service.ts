import { Events, type Client, type Guild, type GuildTextBasedChannel } from "discord.js";
import type { Giveaway } from "@aboutselphy/db";
import type { GiveawayActionStatus } from "@aboutselphy/shared";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { buildGiveawayMessage, pickWinners, winnerAnnouncement } from "./rules";
import { activate, cancel, claimEnd, countEntries, entryUserIds, find, listDue, setWinners } from "./repository";

// Giveaways. The dashboard creates one (a draft) and asks the bot to start it: the bot posts the
// message with an Enter button. The bot ends giveaways when their time is up (a round every 30 s,
// so a restart only delays an ending) and picks the winners at random from the members who entered
// and still qualify. Starting and ending are single conditional updates, so nothing happens twice.

const INTERVAL_MS = 30_000;
const NO_MENTIONS = { parse: [] as never[] };

const view = (g: Giveaway, extra: { ended: boolean; winners: string[]; entryCount?: number }) => ({
  id: g.id,
  prize: g.prize,
  description: g.description,
  imageUrl: g.imageUrl,
  winnerCount: g.winnerCount,
  endsAt: g.endsAt,
  hostName: g.hostName,
  requiredRoleId: g.requiredRoleId,
  ...extra,
});

async function channelOf(guild: Guild, id: string): Promise<GuildTextBasedChannel | null> {
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel && !channel.isDMBased() && channel.guildId === env().DISCORD_GUILD_ID && channel.isTextBased() && "send" in channel ? (channel as GuildTextBasedChannel) : null;
}

/** Posts a draft giveaway and makes it active. */
export async function startGiveaway(guild: Guild, id: string): Promise<GiveawayActionStatus> {
  try {
    const g = await find(id);
    if (!g) return "not-found";
    if (g.status !== "draft") return "wrong-state";
    if (g.endsAt.getTime() <= Date.now()) return "wrong-state";
    if (g.requiredRoleId && !(await guild.roles.fetch(g.requiredRoleId).catch(() => null))) return "role";
    const channel = await channelOf(guild, g.channelId);
    if (!channel) return "channel";

    const ping = g.pingRoleId ? `<@&${g.pingRoleId}>` : "";
    const payload = buildGiveawayMessage(view(g, { ended: false, winners: [] }));
    const message = await channel.send({ ...payload, content: ping, allowedMentions: g.pingRoleId ? { parse: [], roles: [g.pingRoleId] } : NO_MENTIONS });
    if (!(await activate(id, message.id))) {
      await message.delete().catch(() => undefined); // someone else started it first
      return "wrong-state";
    }
    log.info({ giveaway: id, channelId: channel.id, messageId: message.id }, "giveaway started");
    return "done";
  } catch (err) {
    log.error({ err, giveaway: id }, "starting a giveaway failed");
    return "failed";
  }
}

/** Who may win: entered, still in the server, not a bot, and holding the required role (if any). */
async function eligible(guild: Guild, g: Giveaway): Promise<string[]> {
  const ids = await entryUserIds(g.id);
  const ok: string[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const members = await guild.members.fetch({ user: ids.slice(i, i + 100) }).catch(() => null);
    if (!members) continue;
    for (const m of members.values()) {
      if (m.user.bot) continue;
      if (g.requiredRoleId && !m.roles.cache.has(g.requiredRoleId)) continue;
      ok.push(m.id);
    }
  }
  return ok;
}

/** Draws the winners, updates the post and announces them. `reroll` redraws an ended giveaway. */
export async function endGiveaway(guild: Guild, id: string, reroll = false): Promise<GiveawayEndResult> {
  try {
    const g = await find(id);
    if (!g) return { status: "not-found" };
    if (reroll ? g.status !== "ended" : !(await claimEnd(id))) return { status: "wrong-state" };

    const fresh = (await find(id)) ?? g;
    const candidates = await eligible(guild, fresh);
    // A re-roll prefers new people, so the same winner isn't picked again when others are available.
    const pool = reroll ? candidates.filter((c) => !fresh.winners.includes(c)) : candidates;
    const winners = pickWinners(pool.length > 0 ? pool : candidates, fresh.winnerCount);
    await setWinners(id, winners);

    const channel = await channelOf(guild, fresh.channelId);
    if (channel) {
      const message = fresh.messageId ? await channel.messages.fetch(fresh.messageId).catch(() => null) : null;
      const entryCount = await countEntries(id);
      if (message) await message.edit(buildGiveawayMessage(view(fresh, { ended: true, winners, entryCount }))).catch((err) => log.warn({ err, giveaway: id }, "could not update the giveaway message"));
      const announcement = winnerAnnouncement(fresh.prize, winners, reroll);
      if (message) await message.reply(announcement).catch(() => channel.send(announcement).catch(() => undefined));
      else await channel.send(announcement).catch(() => undefined);
    }
    log.info({ giveaway: id, winners: winners.length, reroll }, "giveaway drawn");
    return { status: "done", winners };
  } catch (err) {
    log.error({ err, giveaway: id }, "ending a giveaway failed");
    return { status: "failed" };
  }
}

export type GiveawayEndResult = { status: GiveawayActionStatus; winners?: string[] };

/** Cancels a draft or running giveaway (no draw) and marks its post. */
export async function cancelGiveaway(guild: Guild, id: string): Promise<GiveawayActionStatus> {
  try {
    const g = await find(id);
    if (!g) return "not-found";
    if (!(await cancel(id))) return "wrong-state";
    const channel = g.messageId ? await channelOf(guild, g.channelId) : null;
    const message = channel && g.messageId ? await channel.messages.fetch(g.messageId).catch(() => null) : null;
    if (message) await message.delete().catch(() => undefined);
    log.info({ giveaway: id }, "giveaway cancelled");
    return "done";
  } catch (err) {
    log.error({ err, giveaway: id }, "cancelling a giveaway failed");
    return "failed";
  }
}

let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** Ends every giveaway whose time is up. Never throws. */
export async function endDue(guild: Guild): Promise<number> {
  if (running) return 0;
  running = true;
  let handled = 0;
  try {
    for (const g of await listDue(new Date())) {
      const result = await endGiveaway(guild, g.id);
      if (result.status === "done") handled++;
    }
  } catch (err) {
    log.error({ err }, "giveaway round failed");
  } finally {
    running = false;
  }
  return handled;
}

/** Starts the ender with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it posts on the real server). */
export function startGiveaways(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "giveaways: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const guildOf = () => client.guilds.cache.get(env().DISCORD_GUILD_ID);
  // The dashboard nudges the bot after saving, so a due giveaway doesn't wait for the next round.
  onReload("giveaways", () => {
    const guild = guildOf();
    if (guild) void endDue(guild);
  });
  client.once(Events.ClientReady, () => {
    const run = () => {
      const guild = guildOf();
      if (guild) void endDue(guild);
    };
    run();
    timer = setInterval(run, INTERVAL_MS);
  });
}

export function stopGiveaways(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
