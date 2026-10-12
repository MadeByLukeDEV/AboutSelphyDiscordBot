import { EmbedBuilder, Events, type Client, type GuildMember } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { staffLevel } from "../../lib/permissions";
import { performAction, postModNote } from "../moderation";
import { getRaidConfig } from "./config";
import { endRaid, startRaid } from "./repository";
import { isRaid, RAID_REASON, raidActive, recentJoins } from "./rules";

// Raid protection. Every join (accounts, not bots) is counted; when `joinThreshold` joins fall inside `windowSeconds` the
// bot switches raid mode on for `raidMinutes` and tells the mod log. While it is on, each new account gets the chosen
// reaction: nothing more than the alert, a timeout, or a kick, as a normal numbered case from the bot. Staff and bots are
// never touched. Raid mode survives a restart (the end time is stored) and ends by itself, or with /raid end.

const mutex = new KeyedMutex();
let joins: number[] = [];
let endTimer: ReturnType<typeof setTimeout> | undefined;
let discord: Client | undefined;

const guildOf = () => discord?.guilds.cache.get(env().DISCORD_GUILD_ID);

function scheduleEnd(until: Date): void {
  clearTimeout(endTimer);
  const wait = Math.max(1_000, until.getTime() - Date.now());
  // setTimeout can't wait longer than ~24 days; a raid lasts at most three hours.
  endTimer = setTimeout(() => void finishRaid("It ran its time.").catch((err) => log.error({ err }, "raid: could not end raid mode")), wait);
  endTimer.unref();
}

const note = (title: string, description: string, color: number) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();

/** Switches raid mode off and says so (only the first caller announces). */
export async function finishRaid(why: string): Promise<boolean> {
  clearTimeout(endTimer);
  if (!(await endRaid())) return false;
  const guild = guildOf();
  if (guild) await postModNote(guild, note("Raid mode ended", why, 0x2ecc71));
  log.info({ why }, "raid: mode ended");
  return true;
}

async function react(member: GuildMember, action: "timeout" | "kick", minutes: number): Promise<void> {
  const me = member.guild.members.me ?? (await member.guild.members.fetchMe());
  const result = await performAction({
    guild: member.guild,
    moderator: me,
    type: action,
    targetId: member.id,
    targetUser: member.user,
    reason: RAID_REASON,
    ...(action === "timeout" ? { durationSeconds: minutes * 60 } : {}),
    source: "automod",
  });
  log.info({ user: member.id, action, ok: result.ok }, "raid: reacted to a new account");
}

async function onJoin(member: GuildMember): Promise<void> {
  if (member.guild.id !== env().DISCORD_GUILD_ID || member.user.bot) return;
  const config = await getRaidConfig();
  if (!config.enabled) return;

  await mutex.run("raid", async () => {
    const now = Date.now();
    joins = recentJoins([...joins, now], now, config.windowSeconds);
    const fresh = await getRaidConfig();
    const active = raidActive(fresh.activeUntil, new Date());

    if (!active && isRaid(joins.length, config.joinThreshold)) {
      const until = new Date(now + config.raidMinutes * 60_000);
      await startRaid(until);
      scheduleEnd(until);
      const what = config.action === "alert" ? "Only this alert is sent." : config.action === "timeout" ? `New accounts are timed out for ${config.actionMinutes} minutes.` : "New accounts are kicked.";
      await postModNote(member.guild, note("🚨 Possible raid", `${joins.length} accounts joined within ${config.windowSeconds} seconds. Raid mode is on for ${config.raidMinutes} minutes. ${what}\nEnd it early with \`/raid end\`.`, 0xe74c3c));
      log.warn({ joins: joins.length, minutes: config.raidMinutes }, "raid: raid mode on");
    }
    if (!active && !isRaid(joins.length, config.joinThreshold)) return;

    if ((config.action !== "timeout" && config.action !== "kick") || staffLevel(member) !== null) return;
    await react(member, config.action, config.actionMinutes);
  });
}

/** Whether raid mode is on right now, and until when. */
export async function raidStatus(): Promise<{ enabled: boolean; activeUntil: Date | null; recentJoins: number; threshold: number; windowSeconds: number }> {
  const c = await getRaidConfig();
  return { enabled: c.enabled, activeUntil: raidActive(c.activeUntil, new Date()) ? c.activeUntil : null, recentJoins: recentJoins(joins, Date.now(), c.windowSeconds).length, threshold: c.joinThreshold, windowSeconds: c.windowSeconds };
}

/** Starts watching joins. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it times out and kicks real members). */
export function startRaidProtection(client: Client): void {
  discord = client;
  if (!integrationsActive()) {
    log.info({}, "raid: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.on(Events.GuildMemberAdd, (member) => void onJoin(member).catch((err) => log.error({ err }, "raid join handler failed")));
  client.once(Events.ClientReady, () => {
    // A raid that was on when the bot stopped: keep it on until its time is up, or end it now if that has passed.
    void getRaidConfig().then((c) => {
      if (c.activeUntil && raidActive(c.activeUntil, new Date())) scheduleEnd(c.activeUntil);
      else if (c.activeUntil) void finishRaid("It ended while the bot was away.");
    });
  });
}

export function stopRaidProtection(): void {
  clearTimeout(endTimer);
  endTimer = undefined;
}

