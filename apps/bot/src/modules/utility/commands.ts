import { ChannelType, EmbedBuilder, InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder, type GuildMember } from "discord.js";
import type { Command } from "../../commands/types";
import { afkCommand } from "./afk";
import { embedCommand } from "./embed";
import { escapeText, truncate } from "../../lib/escape";
import { isPowerful } from "../roles";
import { dateAndAgo, listMentions, stamp, yesNo } from "./rules";

// Information commands. Read-only and open to every member. Names are escaped, nothing pings, and
// every reply is an embed (mentions inside embeds don't notify anyone).

const BRAND = 0x00ffa8;
const NO_MENTIONS = { parse: [] as never[] };

const userinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show information about a member")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("member").setDescription("Who (default: you)"))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const user = i.options.getUser("member") ?? i.user;
    const member: GuildMember | null = i.options.getMember("member") ?? (user.id === i.user.id ? i.member : await i.guild.members.fetch(user.id).catch(() => null));
    const roles = member ? [...member.roles.cache.values()].filter((r) => r.id !== i.guild.id).sort((a, b) => b.position - a.position).map((r) => r.id) : [];
    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || BRAND)
      .setAuthor({ name: truncate(escapeText(member?.displayName ?? user.displayName), 80), iconURL: (member ?? user).displayAvatarURL({ size: 128 }) })
      .setThumbnail((member ?? user).displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "User", value: `<@${user.id}>\n\`${user.id}\`${user.bot ? "\nBot" : ""}`, inline: true },
        { name: "Account created", value: dateAndAgo(user.createdAt), inline: true },
        { name: "Joined the server", value: member ? dateAndAgo(member.joinedAt) : "not in the server", inline: true },
      );
    if (member) {
      if (member.premiumSince) embed.addFields({ name: "Boosting since", value: dateAndAgo(member.premiumSince), inline: true });
      if (member.communicationDisabledUntil && member.communicationDisabledUntil > new Date()) embed.addFields({ name: "Timed out until", value: stamp(member.communicationDisabledUntil), inline: true });
      embed.addFields({ name: `Roles (${roles.length})`, value: listMentions(roles, "@&") });
    }
    await i.reply({ embeds: [embed], allowedMentions: NO_MENTIONS });
  },
};

const serverinfo: Command = {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("Show information about this server").setContexts(InteractionContextType.Guild).toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const g = i.guild;
    const channels = [...g.channels.cache.values()].filter((c) => !c.isThread());
    const count = (...types: ChannelType[]) => channels.filter((c) => types.includes(c.type)).length;
    const bots = g.members.cache.filter((m) => m.user.bot).size;
    const embed = new EmbedBuilder()
      .setColor(BRAND)
      .setTitle(truncate(escapeText(g.name), 100))
      .setThumbnail(g.iconURL({ size: 256 }))
      .addFields(
        { name: "Owner", value: `<@${g.ownerId}>`, inline: true },
        { name: "Created", value: dateAndAgo(g.createdAt), inline: true },
        { name: "Members", value: `${g.memberCount}${g.members.cache.size >= g.memberCount ? ` (${g.memberCount - bots} people, ${bots} bots)` : ""}`, inline: true },
        { name: "Channels", value: `${count(ChannelType.GuildText, ChannelType.GuildAnnouncement)} text · ${count(ChannelType.GuildVoice, ChannelType.GuildStageVoice)} voice · ${count(ChannelType.GuildCategory)} categories`, inline: false },
        { name: "Roles", value: String(Math.max(0, g.roles.cache.size - 1)), inline: true },
        { name: "Emoji", value: String(g.emojis.cache.size), inline: true },
        { name: "Boosts", value: `${g.premiumSubscriptionCount ?? 0} (level ${g.premiumTier})`, inline: true },
      )
      .setFooter({ text: `ID ${g.id}` });
    await i.reply({ embeds: [embed], allowedMentions: NO_MENTIONS });
  },
};

const roleinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Show information about a role")
    .setContexts(InteractionContextType.Guild)
    .addRoleOption((o) => o.setName("role").setDescription("Which role").setRequired(true))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const role = i.options.getRole("role", true);
    const full = i.guild.roles.cache.get(role.id);
    if (!full) return void (await i.reply({ content: "I can't find that role.", flags: MessageFlags.Ephemeral }));
    await i.guild.members.fetch().catch(() => undefined);
    const embed = new EmbedBuilder()
      .setColor(full.color || BRAND)
      .setTitle(truncate(escapeText(full.name), 100))
      .addFields(
        { name: "Members", value: String(full.members.size), inline: true },
        { name: "Colour", value: full.color ? `#${full.color.toString(16).padStart(6, "0")}` : "none", inline: true },
        { name: "Position", value: String(full.position), inline: true },
        { name: "Shown separately", value: yesNo(full.hoist), inline: true },
        { name: "Mentionable", value: yesNo(full.mentionable), inline: true },
        { name: "Managed by an integration", value: yesNo(full.managed), inline: true },
        { name: "Powerful permissions", value: yesNo(isPowerful(full.permissions.bitfield) || full.permissions.has(PermissionsBitField.Flags.Administrator)), inline: true },
        { name: "Created", value: dateAndAgo(full.createdAt), inline: true },
      )
      .setFooter({ text: `ID ${full.id}` });
    await i.reply({ embeds: [embed], allowedMentions: NO_MENTIONS });
  },
};

const avatar: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show someone's profile picture, big")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("member").setDescription("Whose (default: yours)"))
    .toJSON(),
  async execute(i) {
    const user = i.options.getUser("member") ?? i.user;
    const png = user.displayAvatarURL({ extension: "png", size: 1024 });
    const webp = user.displayAvatarURL({ extension: "webp", size: 1024 });
    const embed = new EmbedBuilder().setColor(BRAND).setTitle(truncate(escapeText(user.displayName), 100)).setImage(png).setDescription(`[PNG](${png}) · [WebP](${webp})`);
    await i.reply({ embeds: [embed], allowedMentions: NO_MENTIONS });
  },
};

export const utilityCommands: Command[] = [userinfo, serverinfo, roleinfo, avatar, afkCommand, embedCommand];
