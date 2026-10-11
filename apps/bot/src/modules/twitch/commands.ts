import { ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { MAX_TWITCH_STREAMERS } from "@aboutselphy/shared";
import type { Command } from "../../commands/types";
import { escapeText } from "../../lib/escape";
import { log } from "../../lib/log";
import { deleteStreamerByLogin, listStreamers, readConfig, readConnection, updateConfig, upsertStreamer } from "./repository";
import { NoTwitchToken, refreshTwitch, resolveChannel, TwitchError, twitchRuntime } from "./service";

const NO_MENTIONS = { parse: [] as never[] };
const LOGIN = /^[a-zA-Z0-9_]{3,25}$/;

const twitch: Command = {
  data: new SlashCommandBuilder()
    .setName("twitch")
    .setDescription("Announce when a Twitch channel goes live (admins)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Announce a channel (running it again for the same channel changes its settings)")
        .addStringOption((o) => o.setName("channel").setDescription("The Twitch channel name").setRequired(true).setMaxLength(25))
        .addChannelOption((o) =>
          o.setName("post_in").setDescription("Where the announcement goes").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
        )
        .addRoleOption((o) => o.setName("ping").setDescription("Role to ping (leave empty for no ping)"))
        .addStringOption((o) => o.setName("message").setDescription("Text above the embed: {name} {title} {game} {url}").setMaxLength(300)),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Stop announcing a channel")
        .addStringOption((o) => o.setName("channel").setDescription("The Twitch channel name").setRequired(true).setMaxLength(25)),
    )
    .addSubcommand((s) => s.setName("enable").setDescription("Turn announcements on"))
    .addSubcommand((s) => s.setName("disable").setDescription("Turn announcements off"))
    .addSubcommand((s) => s.setName("status").setDescription("Show the connection and every announced channel"))
    .toJSON(),
  requires: "admin",
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    const sub = i.options.getSubcommand();

    try {
      switch (sub) {
        case "add": {
          const login = i.options.getString("channel", true).trim().replace(/^@/, "");
          if (!LOGIN.test(login)) return void (await reply("That doesn't look like a Twitch channel name (letters, numbers, underscore, 3 to 25 characters)."));
          const target = i.options.getChannel("post_in", true, [ChannelType.GuildText, ChannelType.GuildAnnouncement]);
          const role = i.options.getRole("ping");
          if (role && role.id === i.guildId) return void (await reply("Pinging @everyone isn't supported. Pick a normal role."));
          const message = i.options.getString("message");

          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const found = await resolveChannel(login);
          if (!found) return void (await i.editReply({ content: `There is no Twitch channel called \`${escapeText(login)}\`.`, allowedMentions: NO_MENTIONS }));

          const existing = await listStreamers();
          if (!existing.some((s) => s.twitchUserId === found.id) && existing.length >= MAX_TWITCH_STREAMERS) {
            return void (await i.editReply({
              content: `At most ${MAX_TWITCH_STREAMERS} channels can be announced (more would be too many to check every minute). Remove one first with \`/twitch remove\`.`,
              allowedMentions: NO_MENTIONS,
            }));
          }

          await upsertStreamer(
            { twitchUserId: found.id, login: found.login, displayName: found.displayName },
            { channelId: target.id, pingRoleId: role?.id ?? null, ...(message ? { messageTemplate: message } : {}) },
          );
          refreshTwitch();
          const config = await readConfig();
          return void (await i.editReply({
            content: `Announcing **${escapeText(found.displayName)}** in <#${target.id}>${role ? ` and pinging <@&${role.id}>` : ""}.${config.enabled ? "" : " Announcements are still off: turn them on with `/twitch enable`."}`,
            allowedMentions: NO_MENTIONS,
          }));
        }
        case "remove": {
          const login = i.options.getString("channel", true).trim().replace(/^@/, "");
          const removed = await deleteStreamerByLogin(login);
          if (removed) refreshTwitch();
          return void (await reply(removed ? `No longer announcing \`${escapeText(login)}\`. Earlier announcements stay as they are.` : `\`${escapeText(login)}\` wasn't being announced.`));
        }
        case "enable": {
          if ((await listStreamers()).length === 0) return void (await reply("Add a channel first with `/twitch add`."));
          if (!(await readConnection())) return void (await reply("No Twitch account is connected yet. Connect it in the dashboard first."));
          await updateConfig({ enabled: true });
          refreshTwitch();
          return void (await reply("Announcements are on."));
        }
        case "disable":
          await updateConfig({ enabled: false });
          refreshTwitch();
          return void (await reply("Announcements are off."));
        default:
          return void (await reply(await statusText()));
      }
    } catch (err) {
      if (err instanceof NoTwitchToken) {
        const text =
          err.reason === "notConfigured"
            ? "Twitch isn't set up on the bot (client ID, secret and encryption key are missing)."
            : err.reason === "needsReconnect"
              ? "Twitch refused the saved login. Connect the account again in the dashboard."
              : "No Twitch account is connected yet. Connect it in the dashboard first.";
        return void (i.deferred ? await i.editReply({ content: text }) : await reply(text));
      }
      log.error({ err: err instanceof TwitchError ? { code: err.code, status: err.status } : err }, "twitch command failed");
      const text = "Twitch didn't answer as expected. Try again in a moment.";
      return void (i.deferred ? await i.editReply({ content: text }) : await reply(text));
    }
  },
};

async function statusText(): Promise<string> {
  const [config, connection, streamers] = await Promise.all([readConfig(), readConnection(), listStreamers()]);
  const runtime = twitchRuntime();
  const lines = [
    `Announcements: ${config.enabled ? "on" : "off"}`,
    `Bot side: ${
      runtime.active
        ? runtime.connected
          ? "connected to Twitch"
          : "not connected right now (it keeps retrying)"
        : runtime.inactiveReason === "disabledInDev"
          ? "paused (a local run: set BOT_INTEGRATIONS_IN_DEV=true to test)"
          : "not set up (missing Twitch client ID, secret or encryption key)"
    }`,
    `Twitch account: ${connection ? `\`${escapeText(connection.login)}\`${connection.needsReconnect ? " ⚠ must be connected again in the dashboard" : ""}` : "not connected (do it in the dashboard)"}`,
  ];
  for (const s of streamers) {
    lines.push(`• **${escapeText(s.displayName)}** → <#${s.channelId}>${s.pingRoleId ? ` (pings <@&${s.pingRoleId}>)` : ""}${s.enabled ? "" : " (paused)"}`);
  }
  if (streamers.length === 0) lines.push("No channels yet. Add one with `/twitch add`.");
  return lines.join("\n");
}

export const twitchCommands: Command[] = [twitch];
