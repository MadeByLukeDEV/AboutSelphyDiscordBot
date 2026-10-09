import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { snowflake } from "@aboutselphy/shared";
import type { Command } from "../../commands/types";
import { escapeText, truncate } from "../../lib/escape";
import { saveModConfig, getModConfig } from "./config";
import { formatDuration, MAX_TIMEOUT_SECONDS, MIN_TIMEOUT_SECONDS, parseDuration } from "./duration";
import { buildCaseEmbed, typeLabel } from "./embed";
import { performAction, getCase, getInfractions, type ActionRequest } from "./service";

const REASON_MAX = 500;
const NO_MENTIONS = { parse: [] as never[] };

/** Defers (DB + Discord calls can exceed Discord's 3 s limit), runs, answers privately. */
async function run(
  interaction: ChatInputCommandInteraction,
  build: (guild: NonNullable<ChatInputCommandInteraction["guild"]>) => Promise<Omit<ActionRequest, "guild" | "moderator"> | string>,
) {
  if (!interaction.inCachedGuild()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const built = await build(interaction.guild);
  if (typeof built === "string") {
    await interaction.editReply({ content: built, allowedMentions: NO_MENTIONS });
    return;
  }
  const result = await performAction({ ...built, guild: interaction.guild, moderator: interaction.member });
  await interaction.editReply({ content: result.message, allowedMentions: NO_MENTIONS });
}

const guildOnly = (b: SlashCommandBuilder) => b.setContexts(InteractionContextType.Guild);

const warn: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("warn")
    .setDescription("Warn a member (recorded as a case)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("user").setDescription("Member to warn").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Why").setRequired(true).setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (i) =>
    run(i, async () => {
      const user = i.options.getUser("user", true);
      return { type: "warn", targetId: user.id, targetUser: user, reason: i.options.getString("reason", true) };
    }),
};

const timeout: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("timeout")
    .setDescription("Time a member out (mute them) for a while")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((o) => o.setName("duration").setDescription("e.g. 10m, 2h, 1d12h (max 28d)").setRequired(true).setMaxLength(20))
    .addStringOption((o) => o.setName("reason").setDescription("Why").setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (i) =>
    run(i, async () => {
      const seconds = parseDuration(i.options.getString("duration", true));
      if (seconds === null) return "I couldn't read that duration. Use e.g. `10m`, `2h`, `1d12h`.";
      if (seconds < MIN_TIMEOUT_SECONDS) return "The shortest timeout is 1 minute.";
      if (seconds > MAX_TIMEOUT_SECONDS) return `Discord allows at most ${formatDuration(MAX_TIMEOUT_SECONDS)}.`;
      const user = i.options.getUser("user", true);
      return {
        type: "timeout",
        targetId: user.id,
        targetUser: user,
        reason: i.options.getString("reason"),
        durationSeconds: seconds,
      };
    }),
};

const untimeout: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("untimeout")
    .setDescription("Remove a member's timeout")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Why").setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (i) =>
    run(i, async () => {
      const user = i.options.getUser("user", true);
      return { type: "untimeout", targetId: user.id, targetUser: user, reason: i.options.getString("reason") };
    }),
};

const kick: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("kick")
    .setDescription("Kick a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Why").setRequired(true).setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (i) =>
    run(i, async () => {
      const user = i.options.getUser("user", true);
      return { type: "kick", targetId: user.id, targetUser: user, reason: i.options.getString("reason", true) };
    }),
};

const ban: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("ban")
    .setDescription("Ban a user (works for people who already left)")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Why").setRequired(true).setMaxLength(REASON_MAX))
    .addIntegerOption((o) =>
      o.setName("delete_days").setDescription("Also delete their messages from the last N days (0-7)").setMinValue(0).setMaxValue(7),
    )
    .toJSON(),
  requires: "moderator",
  execute: (i) =>
    run(i, async () => {
      const user = i.options.getUser("user", true);
      return {
        type: "ban",
        targetId: user.id,
        targetUser: user,
        reason: i.options.getString("reason", true),
        deleteDays: i.options.getInteger("delete_days") ?? 0,
      };
    }),
};

const unban: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("unban")
    .setDescription("Unban a user by their ID")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((o) => o.setName("user_id").setDescription("The banned user's ID").setRequired(true).setMaxLength(20))
    .addStringOption((o) => o.setName("reason").setDescription("Why").setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (i) =>
    run(i, async () => {
      const id = snowflake.safeParse(i.options.getString("user_id", true).trim());
      if (!id.success) return "That doesn't look like a Discord user ID (17-20 digits).";
      const user = await i.client.users.fetch(id.data).catch(() => null);
      return { type: "unban", targetId: id.data, targetUser: user, reason: i.options.getString("reason") };
    }),
};

const note: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("note")
    .setDescription("Add a private moderator note about a user (no action is taken)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("note").setDescription("The note").setRequired(true).setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (i) =>
    run(i, async () => {
      const user = i.options.getUser("user", true);
      return { type: "note", targetId: user.id, targetUser: user, reason: i.options.getString("note", true) };
    }),
};

const caseCommand: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("case")
    .setDescription("Show a moderation case")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption((o) => o.setName("number").setDescription("Case number").setRequired(true).setMinValue(1))
    .toJSON(),
  requires: "moderator",
  async execute(i) {
    const row = await getCase(i.options.getInteger("number", true));
    if (!row) {
      await i.reply({ content: "No case with that number.", flags: MessageFlags.Ephemeral });
      return;
    }
    await i.reply({ embeds: [buildCaseEmbed(row)], flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
  },
};

const infractions: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("infractions")
    .setDescription("Show a user's moderation history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .toJSON(),
  requires: "moderator",
  async execute(i) {
    const user = i.options.getUser("user", true);
    const { recent, counts } = await getInfractions(user.id);
    if (recent.length === 0) {
      await i.reply({ content: `No cases for <@${user.id}>.`, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
      return;
    }

    const totals = new Map<string, number>();
    for (const c of counts) totals.set(c.type, (totals.get(c.type) ?? 0) + c.count);
    const activeWarnings = counts.filter((c) => c.type === "warn" && c.active).reduce((n, c) => n + c.count, 0);
    const summary = [...totals].map(([type, n]) => `${n} ${typeLabel(type as never).toLowerCase()}`).join(" · ");

    const lines = recent.map((c) => {
      const when = `<t:${Math.floor(c.createdAt.getTime() / 1000)}:d>`;
      const why = c.reason ? ` — ${truncate(escapeText(c.reason), 80)}` : "";
      return `**#${c.caseNumber}** ${typeLabel(c.type)}${c.type === "warn" && !c.active ? " (pardoned)" : ""} · ${when}${why}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`Infractions · ${escapeText(user.username)}`)
      .setDescription(`<@${user.id}> (\`${user.id}\`)\n${summary}\nActive warnings: **${activeWarnings}**\n\n${lines.join("\n")}`)
      .setFooter({ text: `Showing the latest ${recent.length}` });
    await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
  },
};

const modlog: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("modlog")
    .setDescription("Configure the moderation log (admins)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("channel")
        .setDescription("Post every case to this channel")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Log channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName("off").setDescription("Stop posting cases to a channel (they are still recorded)"))
    .addSubcommand((s) =>
      s
        .setName("dm")
        .setDescription("Whether members get a DM when they are warned, timed out, kicked or banned")
        .addBooleanOption((o) => o.setName("enabled").setDescription("Send DMs").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("status").setDescription("Show the current settings"))
    .toJSON(),
  requires: "admin",
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });

    switch (i.options.getSubcommand()) {
      case "channel": {
        const channel = i.options.getChannel("channel", true, [ChannelType.GuildText, ChannelType.GuildAnnouncement]);
        const me = i.guild.members.me ?? (await i.guild.members.fetchMe());
        const perms = channel.permissionsFor(me);
        const missing = (["ViewChannel", "SendMessages", "EmbedLinks"] as const).filter((p) => !perms?.has(p));
        if (missing.length > 0) {
          await reply(`I can't post in <#${channel.id}>: missing ${missing.join(", ")}.`);
          return;
        }
        await saveModConfig({ logChannelId: channel.id });
        await reply(`Cases will be posted to <#${channel.id}>.`);
        return;
      }
      case "off":
        await saveModConfig({ logChannelId: null });
        await reply("Cases are still recorded, but no longer posted anywhere.");
        return;
      case "dm": {
        const enabled = i.options.getBoolean("enabled", true);
        await saveModConfig({ dmOnAction: enabled });
        await reply(`DMs to members are now ${enabled ? "on" : "off"}.`);
        return;
      }
      default: {
        const config = await getModConfig();
        await reply(
          [
            `Log channel: ${config.logChannelId ? `<#${config.logChannelId}>` : "not set"}`,
            `DM members on action: ${config.dmOnAction ? "on" : "off"}`,
            `Next case number: ${config.nextCaseNumber}`,
          ].join("\n"),
        );
      }
    }
  },
};

export const moderationCommands: Command[] = [warn, timeout, untimeout, kick, ban, unban, note, caseCommand, infractions, modlog];
