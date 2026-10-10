import { ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { MAX_TEMP_VOICE_LOBBIES } from "@aboutselphy/shared";
import type { Command } from "../../commands/types";
import { escapeText } from "../../lib/escape";
import { missingFor } from "./checks";
import { addLobby, findLobby, getLobbies, getTempVoiceConfig, removeLobby, saveLobby, saveTempVoiceConfig } from "./config";
import { isBlocked, policyOf, sanitizeRoomName } from "./name";
import { isRoom, roomCount } from "./service";

const NO_MENTIONS = { parse: [] as never[] };

const WARN_MISSING = (missing: string[]) => `\n⚠ I'm missing ${missing.join(", ")} there. Rooms can't be created until that's fixed.`;

const tempvoice: Command = {
  data: new SlashCommandBuilder()
    .setName("tempvoice")
    .setDescription("Set up temporary voice rooms (admins)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((g) =>
      g
        .setName("lobby")
        .setDescription("The voice channels people join to get their own room")
        .addSubcommand((s) =>
          s
            .setName("add")
            .setDescription("Make a voice channel a lobby")
            .addChannelOption((o) => o.setName("channel").setDescription("The lobby voice channel").addChannelTypes(ChannelType.GuildVoice).setRequired(true))
            .addChannelOption((o) => o.setName("category").setDescription("Where its rooms are created (default: next to the lobby)").addChannelTypes(ChannelType.GuildCategory))
            .addStringOption((o) => o.setName("name").setDescription("Room name, {user} becomes the owner's name").setMaxLength(100))
            .addIntegerOption((o) => o.setName("limit").setDescription("Members per room, 0 = no limit").setMinValue(0).setMaxValue(99)),
        )
        .addSubcommand((s) =>
          s
            .setName("set")
            .setDescription("Change a lobby's settings (only what you fill in changes)")
            .addChannelOption((o) => o.setName("channel").setDescription("The lobby").addChannelTypes(ChannelType.GuildVoice).setRequired(true))
            .addChannelOption((o) => o.setName("category").setDescription("Where its rooms are created").addChannelTypes(ChannelType.GuildCategory))
            .addBooleanOption((o) => o.setName("next_to_lobby").setDescription("Create its rooms next to the lobby instead of in a category"))
            .addStringOption((o) => o.setName("name").setDescription("Room name, {user} becomes the owner's name").setMaxLength(100))
            .addIntegerOption((o) => o.setName("limit").setDescription("Members per room, 0 = no limit").setMinValue(0).setMaxValue(99))
            .addBooleanOption((o) => o.setName("video").setDescription("Allow video and screen sharing in its new rooms"))
            .addBooleanOption((o) => o.setName("soundboard").setDescription("Allow the soundboard in its new rooms"))
            .addBooleanOption((o) => o.setName("enabled").setDescription("Switch just this lobby on or off")),
        )
        .addSubcommand((s) =>
          s
            .setName("remove")
            .setDescription("Stop using a channel as a lobby (open rooms stay until they empty)")
            .addChannelOption((o) => o.setName("channel").setDescription("The lobby").addChannelTypes(ChannelType.GuildVoice).setRequired(true)),
        ),
    )
    .addSubcommand((s) => s.setName("enable").setDescription("Turn temporary rooms on, for every lobby"))
    .addSubcommand((s) => s.setName("disable").setDescription("Turn temporary rooms off (existing rooms are still cleaned up)"))
    .addSubcommand((s) => s.setName("status").setDescription("Show every lobby and check the bot's permissions"))
    .toJSON(),
  requires: "admin",
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    const config = await getTempVoiceConfig();
    const group = i.options.getSubcommandGroup(false);
    const sub = i.options.getSubcommand();

    // A name template is checked the same way a rename is: invisible characters are
    // removed, and the admin's words and the built-in list apply.
    const checkedTemplate = (raw: string | null): { ok: true; value: string | undefined } | { ok: false; message: string } => {
      if (raw === null) return { ok: true, value: undefined };
      const template = sanitizeRoomName(raw);
      if (!template) return { ok: false, message: "That name is empty once invisible characters are removed." };
      if (isBlocked(template.replaceAll("{user}", " "), policyOf(config))) return { ok: false, message: "That template contains a blocked word." };
      return { ok: true, value: template };
    };

    if (group === "lobby") {
      const channel = i.options.getChannel("channel", true, [ChannelType.GuildVoice]);

      if (sub === "add") {
        const lobbies = await getLobbies();
        if (lobbies.some((l) => l.channelId === channel.id)) return void (await reply(`<#${channel.id}> is already a lobby. Change it with \`/tempvoice lobby set\`.`));
        if (isRoom(channel.id)) return void (await reply("That's one of the temporary rooms, not a channel you can use as a lobby."));
        if (lobbies.length >= MAX_TEMP_VOICE_LOBBIES) return void (await reply(`There can be at most ${MAX_TEMP_VOICE_LOBBIES} lobbies.`));

        const template = checkedTemplate(i.options.getString("name"));
        if (!template.ok) return void (await reply(template.message));
        const category = i.options.getChannel("category", false, [ChannelType.GuildCategory]);

        await addLobby(channel.id, {
          categoryId: category?.id ?? null,
          ...(template.value ? { nameTemplate: template.value } : {}),
          ...(i.options.getInteger("limit") !== null ? { defaultUserLimit: i.options.getInteger("limit", true) } : {}),
        });
        const missing = await missingFor(i.guild, channel.id, category?.id ?? null);
        return void (await reply(`<#${channel.id}> is a lobby now.${config.enabled ? "" : " Temporary rooms are still off: turn them on with `/tempvoice enable`."}${missing.length ? WARN_MISSING(missing) : ""}`));
      }

      if (sub === "remove") {
        const removed = await removeLobby(channel.id);
        return void (await reply(removed ? `<#${channel.id}> is no longer a lobby. Rooms already open stay until they are empty.` : `<#${channel.id}> wasn't a lobby.`));
      }

      // set
      const existing = await findLobby(channel.id);
      if (!existing) return void (await reply(`<#${channel.id}> isn't a lobby yet. Add it with \`/tempvoice lobby add\`.`));
      const template = checkedTemplate(i.options.getString("name"));
      if (!template.ok) return void (await reply(template.message));

      const category = i.options.getChannel("category", false, [ChannelType.GuildCategory]);
      const nextToLobby = i.options.getBoolean("next_to_lobby");
      const limit = i.options.getInteger("limit");
      const video = i.options.getBoolean("video");
      const soundboard = i.options.getBoolean("soundboard");
      const enabled = i.options.getBoolean("enabled");

      const changes = {
        ...(category ? { categoryId: category.id } : nextToLobby ? { categoryId: null } : {}),
        ...(template.value ? { nameTemplate: template.value } : {}),
        ...(limit !== null ? { defaultUserLimit: limit } : {}),
        ...(video !== null ? { allowVideoByDefault: video } : {}),
        ...(soundboard !== null ? { allowSoundboardByDefault: soundboard } : {}),
        ...(enabled !== null ? { enabled } : {}),
      };
      if (Object.keys(changes).length === 0) return void (await reply("Nothing to change: fill in at least one option."));
      const saved = await saveLobby(channel.id, changes);
      const missing = await missingFor(i.guild, channel.id, saved.categoryId);
      return void (await reply(`Saved the settings for <#${channel.id}>.${missing.length ? WARN_MISSING(missing) : ""}`));
    }

    switch (sub) {
      case "enable": {
        const lobbies = (await getLobbies()).filter((l) => l.enabled);
        if (lobbies.length === 0) return void (await reply("Add a lobby first with `/tempvoice lobby add`."));
        const problems: string[] = [];
        for (const lobby of lobbies) {
          const missing = await missingFor(i.guild, lobby.channelId, lobby.categoryId);
          if (missing.length) problems.push(`<#${lobby.channelId}>: ${missing.join(", ")}`);
        }
        if (problems.length > 0) {
          return void (await reply(`I can't run rooms yet, I'm missing permissions:\n${problems.join("\n")}\nGive my role those and try again.`));
        }
        await saveTempVoiceConfig({ enabled: true });
        return void (await reply(`Temporary rooms are on for ${lobbies.length} ${lobbies.length === 1 ? "lobby" : "lobbies"}.`));
      }
      case "disable":
        await saveTempVoiceConfig({ enabled: false });
        return void (await reply("Temporary rooms are off. Existing rooms are deleted as they empty."));
      default: {
        const lobbies = await getLobbies();
        const lines = [`Temporary rooms: ${config.enabled ? "on" : "off"} · Rooms open right now: ${roomCount()}`];
        for (const lobby of lobbies) {
          const missing = await missingFor(i.guild, lobby.channelId, lobby.categoryId);
          lines.push(
            `<#${lobby.channelId}> ${lobby.enabled ? "" : "(paused) "}→ ${lobby.categoryId ? `<#${lobby.categoryId}>` : "next to the lobby"}, \`${escapeText(lobby.nameTemplate)}\`, ` +
              `limit ${lobby.defaultUserLimit === 0 ? "none" : lobby.defaultUserLimit}, video ${lobby.allowVideoByDefault ? "on" : "off"}, soundboard ${lobby.allowSoundboardByDefault ? "on" : "off"}` +
              (missing.length ? `\n   ⚠ Missing permissions: ${missing.join(", ")}` : ""),
          );
        }
        if (lobbies.length === 0) lines.push("No lobbies yet. Add one with `/tempvoice lobby add`.");
        lines.push(`Blocked words: ${config.blockedWords.length} of your own, built-in list ${config.useDefaultBlocklist ? "on" : "off"}`);
        return void (await reply(lines.join("\n")));
      }
    }
  },
};

export const tempVoiceCommands: Command[] = [tempvoice];
