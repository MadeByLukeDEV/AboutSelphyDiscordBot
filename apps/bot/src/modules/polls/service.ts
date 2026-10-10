import { Events, type Client, type Guild, type GuildTextBasedChannel } from "discord.js";
import type { Poll } from "@aboutselphy/db";
import type { PollActionStatus } from "@aboutselphy/shared";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { activate, allVotes, claimEnd, find, listDue } from "./repository";
import { buildPollMessage, tally } from "./rules";

// Polls. A poll is created (a draft), then started: the bot posts it with one button per option. Votes
// are anonymous (only counts are shown). Updating the post for every click would hit Discord's limits,
// so edits are collected for a moment. The bot ends polls when their time is up (a round every 30 s,
// so a restart only delays an ending); starting and ending are single conditional updates.

const INTERVAL_MS = 30_000;
const EDIT_DELAY_MS = 1500;

async function view(p: Poll, ended: boolean) {
  const votes = await allVotes(p.id);
  return { id: p.id, question: p.question, options: p.options, multiple: p.multiple, endsAt: p.endsAt, ended, counts: tally(p.options.length, votes), voters: new Set(votes.map((v) => v.userId)).size, createdByName: p.createdByName };
}

async function channelOf(guild: Guild, id: string): Promise<GuildTextBasedChannel | null> {
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel && !channel.isDMBased() && channel.guildId === env().DISCORD_GUILD_ID && channel.isTextBased() && "send" in channel ? (channel as GuildTextBasedChannel) : null;
}

export async function startPoll(guild: Guild, id: string): Promise<PollActionStatus> {
  try {
    const p = await find(id);
    if (!p) return "not-found";
    if (p.status !== "draft" || (p.endsAt && p.endsAt.getTime() <= Date.now())) return "wrong-state";
    const channel = await channelOf(guild, p.channelId);
    if (!channel) return "channel";
    const message = await channel.send(buildPollMessage(await view(p, false)));
    if (!(await activate(id, message.id))) {
      await message.delete().catch(() => undefined);
      return "wrong-state";
    }
    log.info({ poll: id, channelId: channel.id }, "poll started");
    return "done";
  } catch (err) {
    log.error({ err, poll: id }, "starting a poll failed");
    return "failed";
  }
}

const pending = new Map<string, ReturnType<typeof setTimeout>>();

export function refreshSoon(guild: Guild, id: string): void {
  if (pending.has(id)) return;
  pending.set(
    id,
    setTimeout(() => {
      pending.delete(id);
      void refreshNow(guild, id).catch((err) => log.warn({ err, poll: id }, "could not refresh a poll post"));
    }, EDIT_DELAY_MS),
  );
}

export async function refreshNow(guild: Guild, id: string): Promise<void> {
  const p = await find(id);
  if (!p || !p.messageId) return;
  const channel = await channelOf(guild, p.channelId);
  const message = channel ? await channel.messages.fetch(p.messageId).catch(() => null) : null;
  if (message) await message.edit(buildPollMessage(await view(p, p.status === "ended")));
}

export async function endPoll(guild: Guild, id: string): Promise<PollActionStatus> {
  try {
    if (!(await find(id))) return "not-found";
    if (!(await claimEnd(id))) return "wrong-state";
    await refreshNow(guild, id);
    log.info({ poll: id }, "poll ended");
    return "done";
  } catch (err) {
    log.error({ err, poll: id }, "ending a poll failed");
    return "failed";
  }
}

/** Deletes the poll's post. The dashboard removes the rows. */
export async function deletePollMessage(guild: Guild, id: string): Promise<PollActionStatus> {
  try {
    const p = await find(id);
    if (!p) return "not-found";
    const channel = p.messageId ? await channelOf(guild, p.channelId) : null;
    const message = channel && p.messageId ? await channel.messages.fetch(p.messageId).catch(() => null) : null;
    if (message) await message.delete();
    return "done";
  } catch (err) {
    log.error({ err, poll: id }, "deleting a poll post failed");
    return "failed";
  }
}

let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** Ends every poll whose time is up. Never throws. */
export async function endDue(guild: Guild): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const p of await listDue(new Date())) await endPoll(guild, p.id);
  } catch (err) {
    log.error({ err }, "poll round failed");
  } finally {
    running = false;
  }
}

/** Starts the ender with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it edits posts on the real server). */
export function startPolls(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "polls: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const guildOf = () => client.guilds.cache.get(env().DISCORD_GUILD_ID);
  onReload("polls", () => {
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

export function stopPolls(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
