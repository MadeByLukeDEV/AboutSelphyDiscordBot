import { AttachmentBuilder, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { levelFromXp, progressOf } from "@aboutselphy/shared/levels";
import type { Command } from "../../commands/types";
import { fetchAvatar } from "../../lib/avatar";
import { escapeText } from "../../lib/escape";
import { log } from "../../lib/log";
import { getLevelConfig } from "./config";
import { countMembers, findXp, rankOf, resetXp, setXp, topMembers } from "./repository";
import { renderRankCard } from "./rank-card";
import { syncRewardRoles } from "./service";

const NO_MENTIONS = { parse: [] as never[] };
const BRAND = 0x00ffa8;
const PAGE_SIZE = 10;
const guildOnly = (b: SlashCommandBuilder) => b.setContexts(InteractionContextType.Guild);

const rank: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("rank")
    .setDescription("Show your level and XP (or someone else's)")
    .addUserOption((o) => o.setName("user").setDescription("Whose rank to show (default: you)"))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const { config } = await getLevelConfig();
    if (!config.enabled) return void (await i.reply({ content: "Leveling isn't switched on in this server.", flags: MessageFlags.Ephemeral }));
    await i.deferReply();

    const user = i.options.getUser("user") ?? i.user;
    if (user.bot) return void (await i.editReply({ content: "Bots don't earn XP." }));
    const row = await findXp(user.id);
    if (!row || row.xp === 0) return void (await i.editReply({ content: user.id === i.user.id ? "You haven't earned any XP yet. Chat or join a voice channel!" : "That member hasn't earned any XP yet.", allowedMentions: NO_MENTIONS }));

    const progress = progressOf(row.xp);
    try {
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      const png = await renderRankCard({
        username: member?.displayName ?? user.username,
        avatar: await fetchAvatar(user.displayAvatarURL({ extension: "png", size: 256 })),
        rank: await rankOf(row.xp),
        level: progress.level,
        into: progress.into,
        needed: progress.needed,
        percent: progress.percent,
        totalXp: row.xp,
        color: BRAND,
      });
      await i.editReply({ files: [new AttachmentBuilder(png, { name: "rank.png" })], allowedMentions: NO_MENTIONS });
    } catch (err) {
      // If drawing fails the numbers are still useful.
      log.error({ err }, "rank card failed");
      await i.editReply({ content: `Level **${progress.level}** · ${progress.into}/${progress.needed} XP · ${row.xp} XP in total`, allowedMentions: NO_MENTIONS });
    }
  },
};

const leaderboard: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("leaderboard")
    .setDescription("The members with the most XP")
    .addIntegerOption((o) => o.setName("page").setDescription("Page number").setMinValue(1).setMaxValue(1000))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const { config } = await getLevelConfig();
    if (!config.enabled) return void (await i.reply({ content: "Leveling isn't switched on in this server.", flags: MessageFlags.Ephemeral }));
    const page = i.options.getInteger("page") ?? 1;
    const total = await countMembers();
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > pages) return void (await i.reply({ content: `There are only ${pages} ${pages === 1 ? "page" : "pages"}.`, flags: MessageFlags.Ephemeral }));

    const rows = await topMembers((page - 1) * PAGE_SIZE, PAGE_SIZE);
    const lines = rows.map((r, n) => {
      const place = (page - 1) * PAGE_SIZE + n + 1;
      const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : `**${place}.**`;
      return `${medal} <@${r.userId}> · level **${levelFromXp(r.xp)}** · ${r.xp.toLocaleString("en")} XP`;
    });
    const embed = new EmbedBuilder().setColor(BRAND).setTitle(`${escapeText(i.guild.name)} leaderboard`).setDescription(lines.join("\n") || "Nobody has earned XP yet.").setFooter({ text: `Page ${page} of ${pages}` });
    await i.reply({ embeds: [embed], allowedMentions: NO_MENTIONS });
  },
};

const xp: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("xp")
    .setDescription("Change a member's XP (admins)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Give XP")
        .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("How much").setRequired(true).setMinValue(1).setMaxValue(1_000_000)),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Take XP away")
        .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("How much").setRequired(true).setMinValue(1).setMaxValue(1_000_000)),
    )
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Set the XP to an exact number")
        .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("XP").setRequired(true).setMinValue(0).setMaxValue(10_000_000)),
    )
    .addSubcommand((s) => s.setName("reset").setDescription("Remove all of a member's XP").addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)))
    .toJSON(),
  requires: "admin",
  async execute(i) {
    if (!i.inCachedGuild()) return;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const reply = (content: string) => i.editReply({ content, allowedMentions: NO_MENTIONS });
    const user = i.options.getUser("user", true);
    if (user.bot) return void (await reply("Bots don't earn XP."));
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    const sub = i.options.getSubcommand();
    const current = (await findXp(user.id))?.xp ?? 0;

    let target: number;
    if (sub === "reset") target = 0;
    else {
      const amount = i.options.getInteger("amount", true);
      target = sub === "add" ? current + amount : sub === "remove" ? Math.max(0, current - amount) : amount;
    }

    if (sub === "reset") await resetXp(user.id);
    else await setXp(user.id, target, member?.displayName ?? user.username);
    const level = levelFromXp(target);
    // Rewards follow the new level (including taking back roles that are no longer reached).
    if (member) await syncRewardRoles(member, level).catch((err) => log.error({ err, user: user.id }, "syncing level rewards after /xp failed"));
    log.info({ admin: i.user.id, user: user.id, sub, from: current, to: target }, "xp changed by an admin");
    await reply(`<@${user.id}> now has **${target.toLocaleString("en")} XP** (level ${level}).`);
  },
};

export const levelCommands: Command[] = [rank, leaderboard, xp];
