import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Guild,
} from "discord.js";
import type { Command } from "../../commands/types";
import { escapeText } from "../../lib/escape";
import { getTempVoiceConfig, saveTempVoiceConfig } from "./config";
import { findBlockedWord, sanitizeRoomName } from "./name";
import { missingBotPermissions } from "./permissions";
import { roomCount } from "./service";

const NO_MENTIONS = { parse: [] as never[] };

/**
 * What the bot is missing to run rooms in this category (or next to the lobby).
 * Checked when an admin sets things up, so a wrong role setup shows up now and
 * not as a silent failure the first time someone joins the lobby.
 */
async function missingFor(guild: Guild, lobbyId: string | null, categoryId: string | null): Promise<string[]> {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const target =
    (categoryId ? guild.channels.cache.get(categoryId) : null) ??
    (lobbyId ? (guild.channels.cache.get(lobbyId)?.parent ?? guild.channels.cache.get(lobbyId)) : null);
  const perms = target ? target.permissionsFor(me) : me.permissions;
  return missingBotPermissions((flag) => perms?.has(flag) ?? false);
}

const tempvoice: Command = {
  data: new SlashCommandBuilder()
    .setName("tempvoice")
    .setDescription("Set up temporary voice rooms (admins)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("lobby")
        .setDescription("The voice channel people join to get their own room")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Lobby voice channel").addChannelTypes(ChannelType.GuildVoice).setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("category")
        .setDescription("Where rooms are created (leave empty to use the lobby's own category)")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Category").addChannelTypes(ChannelType.GuildCategory),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("name")
        .setDescription("The name of new rooms, {user} becomes the owner's name")
        .addStringOption((o) => o.setName("template").setDescription("e.g. {user}'s room").setRequired(true).setMaxLength(100)),
    )
    .addSubcommand((s) =>
      s
        .setName("limit")
        .setDescription("How many members a new room allows")
        .addIntegerOption((o) => o.setName("members").setDescription("0 = no limit").setRequired(true).setMinValue(0).setMaxValue(99)),
    )
    .addSubcommand((s) => s.setName("enable").setDescription("Turn temporary rooms on"))
    .addSubcommand((s) => s.setName("disable").setDescription("Turn temporary rooms off (existing rooms are still cleaned up)"))
    .addSubcommand((s) => s.setName("status").setDescription("Show the settings and check the bot's permissions"))
    .toJSON(),
  requires: "admin",
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    const config = await getTempVoiceConfig();

    switch (i.options.getSubcommand()) {
      case "lobby": {
        const channel = i.options.getChannel("channel", true, [ChannelType.GuildVoice]);
        const missing = await missingFor(i.guild, channel.id, config.categoryId);
        await saveTempVoiceConfig({ lobbyChannelId: channel.id });
        await reply(
          `The lobby is now <#${channel.id}>.` +
            (missing.length ? `\n⚠ I'm missing ${missing.join(", ")} there. Rooms can't be created until that's fixed.` : ""),
        );
        return;
      }
      case "category": {
        const channel = i.options.getChannel("channel", false, [ChannelType.GuildCategory]);
        const missing = await missingFor(i.guild, config.lobbyChannelId, channel?.id ?? null);
        await saveTempVoiceConfig({ categoryId: channel?.id ?? null });
        await reply(
          (channel ? `Rooms are created in <#${channel.id}>.` : "Rooms are created next to the lobby.") +
            (missing.length ? `\n⚠ I'm missing ${missing.join(", ")} there. Rooms can't be created until that's fixed.` : ""),
        );
        return;
      }
      case "name": {
        const template = sanitizeRoomName(i.options.getString("template", true));
        if (!template) {
          await reply("That name is empty once invisible characters are removed.");
          return;
        }
        const blocked = findBlockedWord(template.replaceAll("{user}", ""), config.blockedWords);
        if (blocked) {
          await reply("That template contains a blocked word.");
          return;
        }
        await saveTempVoiceConfig({ nameTemplate: template });
        await reply(`New rooms are named \`${escapeText(template)}\`.`);
        return;
      }
      case "limit": {
        const members = i.options.getInteger("members", true);
        await saveTempVoiceConfig({ defaultUserLimit: members });
        await reply(members === 0 ? "New rooms have no member limit." : `New rooms allow ${members} members.`);
        return;
      }
      case "enable": {
        if (!config.lobbyChannelId) {
          await reply("Set a lobby first with `/tempvoice lobby`.");
          return;
        }
        const missing = await missingFor(i.guild, config.lobbyChannelId, config.categoryId);
        if (missing.length > 0) {
          await reply(`I can't run rooms yet: I'm missing ${missing.join(", ")}. Give my role those permissions and try again.`);
          return;
        }
        await saveTempVoiceConfig({ enabled: true });
        await reply(`Temporary rooms are on. Joining <#${config.lobbyChannelId}> now creates a room.`);
        return;
      }
      case "disable":
        await saveTempVoiceConfig({ enabled: false });
        await reply("Temporary rooms are off. Existing rooms are deleted as they empty.");
        return;
      default: {
        const missing = await missingFor(i.guild, config.lobbyChannelId, config.categoryId);
        await reply(
          [
            `Status: ${config.enabled ? "on" : "off"}`,
            `Lobby: ${config.lobbyChannelId ? `<#${config.lobbyChannelId}>` : "not set"}`,
            `Category: ${config.categoryId ? `<#${config.categoryId}>` : "next to the lobby"}`,
            `Name: \`${escapeText(config.nameTemplate)}\``,
            `Member limit: ${config.defaultUserLimit === 0 ? "none" : config.defaultUserLimit}`,
            `Video by default: ${config.allowVideoByDefault ? "on" : "off"} · Soundboard by default: ${config.allowSoundboardByDefault ? "on" : "off"}`,
            `Blocked words: ${config.blockedWords.length}`,
            `Rooms open right now: ${roomCount()}`,
            missing.length ? `⚠ Missing permissions: ${missing.join(", ")}` : "Permissions: all good",
          ].join("\n"),
        );
      }
    }
  },
};

export const tempVoiceCommands: Command[] = [tempvoice];
