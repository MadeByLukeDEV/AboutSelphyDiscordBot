import { AttachmentBuilder, Events, type Client, type Guild } from "discord.js";
import { fillDate } from "@aboutselphy/shared/member-card";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import { renderMemberCard } from "../membercards";
import { checkRole } from "../roles";
import { getBirthdayConfig } from "./config";
import { EmbedBuilder } from "discord.js";
import { isMilestoneAge } from "@aboutselphy/shared/birthdays";
import { allBirthdays, birthdaysInMonth, claimDay, claimSummary, removeBirthday } from "./repository";
import { ageThisYear, dayKey, formatDay, isBirthdayToday, monthKey, monthName, renderGreeting, summaryDue, summaryLines, todayIn } from "./rules";

// The birthday round. Every 10 minutes (and when the settings change) it greets the members whose
// birthday is today in the configured time zone, once per day (claimed with one conditional
// UPDATE), and takes the birthday role off everyone else. A restart in the middle of the day
// greets nobody twice.

const INTERVAL_MS = 10 * 60_000;
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

export async function celebrateRound(guild: Guild): Promise<void> {
  if (running) return;
  if (!(await moduleOn("birthdays"))) return;
  running = true;
  try {
    const config = await getBirthdayConfig();
    if (!config.enabled) return;
    const today = todayIn(new Date(), config.timeZone);
    const key = dayKey(today);
    const due = (await allBirthdays()).filter((b) => isBirthdayToday(b, today));
    const dueIds = new Set(due.map((b) => b.userId));

    const roleOk = config.roleId ? checkRole(guild, config.roleId) === "ok" : false;
    if (config.roleId && !roleOk) log.warn({ roleId: config.roleId }, "birthdays: the role can't be handed out (missing, too high or too powerful)");
    const channel = config.channelId ? await guild.channels.fetch(config.channelId).catch(() => null) : null;
    if (config.channelId && (!channel || !channel.isTextBased() || !("send" in channel))) log.warn({ channelId: config.channelId }, "birthdays: the channel is missing or the bot can't post in it");

    for (const b of due) {
      const member = await guild.members.fetch(b.userId).catch(() => null);
      if (!member || member.user.bot) {
        log.debug({ user: b.userId }, "birthdays: member not in the server, skipped");
        continue;
      }
      if (roleOk && config.roleId && !member.roles.cache.has(config.roleId)) await member.roles.add(config.roleId, "Birthday").catch((err) => log.warn({ err, user: b.userId }, "birthdays: could not give the role"));
      if (!(await claimDay(b.userId, key))) continue; // greeted already today
      const age = ageThisYear(b.year, today.year);
      if (channel && channel.isTextBased() && "send" in channel) {
        const card = config.cardEnabled
          ? await renderMemberCard({
              kind: "birthday",
              username: member.displayName,
              avatarUrl: member.displayAvatarURL({ extension: "png", size: 256 }),
              title: config.cardTitle,
              subtitle: fillDate(config.cardSubtitle, formatDay(b.month, b.day)),
              mode: config.cardMode === "sticker" ? "sticker" : "background",
            })
          : null;
        await channel
          .send({
            content: renderGreeting(isMilestoneAge(age) && config.milestoneMessage ? config.milestoneMessage : config.message, { id: member.id, name: member.displayName }, age),
            files: card ? [new AttachmentBuilder(Buffer.from(card), { name: "birthday.png" })] : [],
            allowedMentions: { parse: [], users: [member.id] },
          })
          .then(() => log.info({ user: b.userId }, "birthdays: greeted"))
          .catch((err) => log.warn({ err, user: b.userId }, "birthdays: could not post the greeting"));
      }
    }

    if (config.monthlySummary) await monthlySummary(guild, config.channelId, config.lastSummaryMonth, today).catch((err) => log.warn({ err }, "birthdays: the monthly summary failed"));

    // Everyone else gives the role back.
    if (roleOk && config.roleId) {
      const role = guild.roles.cache.get(config.roleId);
      for (const member of role?.members.values() ?? []) {
        if (!dueIds.has(member.id)) await member.roles.remove(config.roleId, "Birthday is over").catch((err) => log.warn({ err, user: member.id }, "birthdays: could not remove the role"));
      }
    }
  } catch (err) {
    log.error({ err }, "birthday round failed");
  } finally {
    running = false;
  }
}

/**
 * The first round of a new month posts who has a birthday in it (only members who are in the server). The first time it only remembers
 * the month, so switching it on never posts mid-month; one conditional UPDATE decides who posts, so a restart can't post it twice.
 */
async function monthlySummary(guild: Guild, channelId: string | null, last: string | null, today: ReturnType<typeof todayIn>): Promise<void> {
  const key = monthKey(today);
  const due = summaryDue(key, last);
  if (due === "none") return;
  if (!(await claimSummary(key, last))) return;
  if (due === "seed") return void log.info({ month: key }, "birthdays: monthly summary armed (nothing posted)");
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
  if (!channel || !channel.isTextBased() || !("send" in channel)) return;
  const present: Array<{ userId: string; month: number; day: number }> = [];
  for (const b of await birthdaysInMonth(today.month)) if (await guild.members.fetch(b.userId).then((m) => !m.user.bot).catch(() => false)) present.push(b);
  if (present.length === 0) return;
  const embed = new EmbedBuilder().setColor(0x00ffa8).setTitle(`🎂 Birthdays in ${monthName(today.month)}`).setDescription(summaryLines(present, today.year).join("\n").slice(0, 4000));
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  log.info({ month: key, count: present.length }, "birthdays: monthly summary posted");
}

/** Starts the round with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it posts on the real server). */
export function startBirthdays(client: Client): void {
  // A member who leaves takes their date with them (personal data).
  client.on(Events.GuildMemberRemove, (member) => {
    if (member.guild.id !== env().DISCORD_GUILD_ID) return;
    void removeBirthday(member.id).catch((err) => log.warn({ err }, "birthdays: could not forget a member who left"));
  });
  if (!integrationsActive()) {
    log.info({}, "birthdays: not starting the round (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const guildOf = () => client.guilds.cache.get(env().DISCORD_GUILD_ID);
  const run = () => {
    const guild = guildOf();
    if (guild) void celebrateRound(guild);
  };
  onReload("birthdays", run);
  client.once(Events.ClientReady, () => {
    run();
    timer = setInterval(run, INTERVAL_MS);
  });
}

export function stopBirthdays(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
