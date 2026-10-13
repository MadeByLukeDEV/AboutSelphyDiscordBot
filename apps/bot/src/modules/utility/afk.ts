import { Events, InteractionContextType, MessageFlags, SlashCommandBuilder, type Client } from "discord.js";
import { prisma } from "@aboutselphy/db";
import type { Command } from "../../commands/types";
import { Cooldown } from "../../lib/cooldown";
import { env, integrationsActive } from "../../lib/env";
import { escapeText, truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";

// /afk: a member marks themselves away with an optional reason. When someone mentions them the bot says so, and the first
// message they write themselves ends it. Needs no privileged intent (it only reads who a message mentions). The status is kept
// in the database (so a restart doesn't forget it), mirrored in memory (so ordinary messages cost no query), and forgotten when the
// member leaves the server or deletes their data with /mydata delete.

export const MAX_AFK_REASON = 100;
const NO_MENTIONS = { parse: [] as never[], repliedUser: false };
const afk = new Map<string, { reason: string; since: Date }>();
let loaded = false;
const noticeGap = new Cooldown(15_000);

async function load(): Promise<void> {
  if (loaded) return;
  for (const row of await prisma.afkStatus.findMany()) afk.set(row.userId, { reason: row.reason, since: row.since });
  loaded = true;
}

/** "away: reason" text for a member, escaped (the reason is typed by a member). */
export function afkLine(userId: string, reason: string, since: Date): string {
  const why = reason.trim() === "" ? "" : `: ${escapeText(truncate(reason, MAX_AFK_REASON))}`;
  return `<@${userId}> is AFK${why} (since <t:${Math.floor(since.getTime() / 1000)}:R>)`;
}

export const afkCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Mark yourself as away; the bot tells people who mention you")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName("reason").setDescription("Why you are away (optional)").setMaxLength(MAX_AFK_REASON))
    .toJSON(),
  async execute(i) {
    const reason = (i.options.getString("reason") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_AFK_REASON);
    const since = new Date();
    await prisma.afkStatus.upsert({ where: { userId: i.user.id }, update: { reason, since }, create: { userId: i.user.id, reason, since } });
    await load();
    afk.set(i.user.id, { reason, since });
    await i.reply({ content: `You are AFK now${reason ? `: ${escapeText(reason)}` : ""}. Your next message ends it.`, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
  },
};

/** Starts watching messages. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it answers in real channels). */
export function startAfk(client: Client): void {
  client.on(Events.GuildMemberRemove, (member) => {
    if (member.guild.id !== env().DISCORD_GUILD_ID) return;
    afk.delete(member.id);
    void prisma.afkStatus.deleteMany({ where: { userId: member.id } }).catch((err) => log.warn({ err }, "afk: could not forget a member who left"));
  });
  if (!integrationsActive()) {
    log.info({}, "afk: not watching messages (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.on(Events.MessageCreate, (message) => {
    if (message.guildId !== env().DISCORD_GUILD_ID || message.author.bot || message.system) return;
    void (async () => {
      if (!(await moduleOn("utility"))) return;
      await load();
      if (afk.size === 0) return;

      if (afk.has(message.author.id)) {
        afk.delete(message.author.id);
        await prisma.afkStatus.deleteMany({ where: { userId: message.author.id } });
        if (noticeGap.tryAcquire(`back:${message.channelId}`)) await message.reply({ content: "Welcome back, your AFK status is gone.", allowedMentions: NO_MENTIONS });
        return;
      }
      const away = [...message.mentions.users.values()].filter((u) => !u.bot && u.id !== message.author.id && afk.has(u.id)).slice(0, 3);
      if (away.length === 0 || !noticeGap.tryAcquire(`notice:${message.channelId}`)) return;
      const lines = away.map((u) => {
        const s = afk.get(u.id)!;
        return afkLine(u.id, s.reason, s.since);
      });
      await message.reply({ content: lines.join("\n"), allowedMentions: NO_MENTIONS });
    })().catch((err) => log.warn({ err }, "afk: handler failed"));
  });
}
