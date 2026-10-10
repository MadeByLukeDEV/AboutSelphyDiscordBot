import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
} from "discord.js";
import type { Command } from "../../commands/types";
import { escapeText, truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { formatDuration, parseDuration } from "./duration";
import { MAX_PURGE, MAX_SCAN, selectForPurge, type PurgeCandidate } from "./purge";
import { postModNote } from "./service";

// Channel tools for moderators: /purge, /slowmode, /lock, /unlock. They don't
// create cases (no member is punished); each is logged to the mod log channel.

const NO_MENTIONS = { parse: [] as never[] };
const REASON_MAX = 300;
const MAX_SLOWMODE_SECONDS = 21_600; // Discord's limit: 6 hours

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread] as const;

const guildOnly = (b: SlashCommandBuilder) => b.setContexts(InteractionContextType.Guild);

/** The channel the command targets: the option, or where it was typed. */
function targetChannel(i: ChatInputCommandInteraction<"cached">): GuildTextBasedChannel | null {
  const picked = i.options.getChannel("channel", false, [...TEXT_TYPES]);
  const channel = picked ?? i.channel;
  return channel && !channel.isDMBased() && channel.isTextBased() ? (channel as GuildTextBasedChannel) : null;
}

function noteEmbed(title: string, color: number, i: ChatInputCommandInteraction<"cached">, channelId: string, extra: Array<{ name: string; value: string }>, reason: string | null) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: "Channel", value: `<#${channelId}>`, inline: true },
      { name: "Moderator", value: `<@${i.user.id}> (${i.user.id})`, inline: true },
      ...extra.map((f) => ({ ...f, inline: true })),
    )
    .setTimestamp();
  if (reason) embed.addFields({ name: "Reason", value: truncate(escapeText(reason), 1000) });
  return embed;
}

/** Defers (Discord calls can exceed 3 s), then answers privately. */
async function privately(i: ChatInputCommandInteraction, work: (i: ChatInputCommandInteraction<"cached">) => Promise<string>) {
  if (!i.inCachedGuild()) return;
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  let content: string;
  try {
    content = await work(i);
  } catch (err) {
    log.error({ err, command: i.commandName }, "channel tool failed");
    content = "Discord refused that. Check that my role has the permissions in that channel.";
  }
  await i.editReply({ content, allowedMentions: NO_MENTIONS });
}

// -- /purge -------------------------------------------------------------------------------

async function collect(channel: GuildTextBasedChannel, userId: string | null, botsOnly: boolean, count: number): Promise<string[]> {
  const picked: string[] = [];
  let before: string | undefined;
  let scanned = 0;
  while (scanned < MAX_SCAN && picked.length < count) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (batch.size === 0) break;
    scanned += batch.size;
    const candidates: PurgeCandidate[] = [...batch.values()].map((m) => ({
      id: m.id,
      authorId: m.author.id,
      authorIsBot: m.author.bot,
      createdAt: m.createdTimestamp,
      pinned: m.pinned,
    }));
    picked.push(...selectForPurge(candidates, { count: count - picked.length, userId, botsOnly, now: Date.now() }));
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return picked;
}

const purge: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("purge")
    .setDescription("Delete recent messages in a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName("count").setDescription(`How many messages to delete (1 to ${MAX_PURGE})`).setRequired(true).setMinValue(1).setMaxValue(MAX_PURGE))
    .addUserOption((o) => o.setName("user").setDescription("Only this member's messages"))
    .addBooleanOption((o) => o.setName("bots").setDescription("Only messages from bots"))
    .addChannelOption((o) => o.setName("channel").setDescription("Where (default: this channel)").addChannelTypes(...TEXT_TYPES))
    .addStringOption((o) => o.setName("reason").setDescription("Why (goes to the mod log)").setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (interaction) =>
    privately(interaction, async (i) => {
      const channel = targetChannel(i);
      if (!channel) return "I can't purge there.";
      const me = i.guild.members.me ?? (await i.guild.members.fetchMe());
      const perms = channel.permissionsFor(me);
      const missing = [
        !perms?.has(PermissionFlagsBits.ViewChannel) && "View Channel",
        !perms?.has(PermissionFlagsBits.ReadMessageHistory) && "Read Message History",
        !perms?.has(PermissionFlagsBits.ManageMessages) && "Manage Messages",
      ].filter(Boolean);
      if (missing.length > 0) return `I'm missing ${missing.join(", ")} in <#${channel.id}>.`;

      const count = i.options.getInteger("count", true);
      const user = i.options.getUser("user");
      const botsOnly = i.options.getBoolean("bots") ?? false;
      if (user && botsOnly) return "Pick either a member or bots, not both.";
      const reason = i.options.getString("reason");

      const ids = await collect(channel, user?.id ?? null, botsOnly, count);
      if (ids.length === 0) return "Nothing to delete: no matching messages from the last 14 days (pinned messages are kept).";

      // bulkDelete takes up to 100 ids; `true` also drops any that turned out to be too old.
      const deleted = await channel.bulkDelete(ids, true);
      log.info({ channel: channel.id, moderator: i.user.id, requested: count, deleted: deleted.size }, "purge");

      const filter = user ? `Messages from <@${user.id}>` : botsOnly ? "Messages from bots" : "Latest messages";
      await postModNote(
        i.guild,
        noteEmbed("Messages purged", 0xe67e22, i, channel.id, [{ name: "Deleted", value: `${deleted.size}` }, { name: "Filter", value: filter }], reason),
      );
      return `Deleted ${deleted.size} ${deleted.size === 1 ? "message" : "messages"} in <#${channel.id}>.`;
    }),
};

// -- /slowmode ------------------------------------------------------------------------------

const slowmode: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("slowmode")
    .setDescription("Limit how often members can post in a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) => o.setName("delay").setDescription("e.g. 10s, 2m, 1h (max 6h), or off").setRequired(true).setMaxLength(10))
    .addChannelOption((o) => o.setName("channel").setDescription("Where (default: this channel)").addChannelTypes(...TEXT_TYPES))
    .toJSON(),
  requires: "moderator",
  execute: (interaction) =>
    privately(interaction, async (i) => {
      const channel = targetChannel(i);
      if (!channel || !("setRateLimitPerUser" in channel)) return "Slow mode can't be set there.";
      const raw = i.options.getString("delay", true).trim().toLowerCase();
      const seconds = raw === "off" || raw === "0" ? 0 : parseDuration(raw);
      if (seconds === null) return "I couldn't read that. Use e.g. `10s`, `2m`, `1h`, or `off`.";
      if (seconds > MAX_SLOWMODE_SECONDS) return `Discord allows at most ${formatDuration(MAX_SLOWMODE_SECONDS)}.`;

      await channel.setRateLimitPerUser(seconds, `Slow mode by ${i.user.tag}`);
      log.info({ channel: channel.id, moderator: i.user.id, seconds }, "slowmode");
      await postModNote(
        i.guild,
        noteEmbed(seconds === 0 ? "Slow mode off" : "Slow mode on", 0x3498db, i, channel.id, seconds === 0 ? [] : [{ name: "Delay", value: formatDuration(seconds) }], null),
      );
      return seconds === 0 ? `Slow mode is off in <#${channel.id}>.` : `Members can post once every ${formatDuration(seconds)} in <#${channel.id}>.`;
    }),
};

// -- /lock and /unlock ---------------------------------------------------------------------------

async function setLocked(i: ChatInputCommandInteraction<"cached">, locked: boolean): Promise<string> {
  const channel = targetChannel(i);
  if (!channel || !("permissionOverwrites" in channel) || channel.isThread()) return "That channel can't be locked.";
  const everyone = i.guild.roles.everyone;
  const reason = i.options.getString("reason");

  const me = i.guild.members.me ?? (await i.guild.members.fetchMe());
  if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageRoles)) return `I need the Manage Permissions permission in <#${channel.id}> to do that.`;

  const currentlyLocked = channel.permissionOverwrites.cache.get(everyone.id)?.deny.has(PermissionFlagsBits.SendMessages) ?? false;
  if (locked === currentlyLocked) return locked ? `<#${channel.id}> is already locked.` : `<#${channel.id}> isn't locked.`;

  // Locking denies sending for @everyone. Unlocking clears that one setting back to
  // "inherit", it doesn't grant anything, so the channel returns to its category's rules.
  await channel.permissionOverwrites.edit(
    everyone,
    { SendMessages: locked ? false : null, SendMessagesInThreads: locked ? false : null, CreatePublicThreads: locked ? false : null },
    { reason: `${locked ? "Locked" : "Unlocked"} by ${i.user.tag}${reason ? `: ${reason}` : ""}` },
  );
  log.info({ channel: channel.id, moderator: i.user.id, locked }, "channel lock changed");
  await postModNote(i.guild, noteEmbed(locked ? "Channel locked" : "Channel unlocked", locked ? 0xe74c3c : 0x2ecc71, i, channel.id, [], reason));
  return locked
    ? `Locked <#${channel.id}>. Members can read but not post; staff with their own permissions still can.`
    : `Unlocked <#${channel.id}>.`;
}

const lock: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("lock")
    .setDescription("Stop members from posting in a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((o) => o.setName("channel").setDescription("Where (default: this channel)").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((o) => o.setName("reason").setDescription("Why (goes to the mod log)").setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (interaction) => privately(interaction, (i) => setLocked(i, true)),
};

const unlock: Command = {
  data: guildOnly(new SlashCommandBuilder())
    .setName("unlock")
    .setDescription("Let members post in a locked channel again")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((o) => o.setName("channel").setDescription("Where (default: this channel)").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((o) => o.setName("reason").setDescription("Why (goes to the mod log)").setMaxLength(REASON_MAX))
    .toJSON(),
  requires: "moderator",
  execute: (interaction) => privately(interaction, (i) => setLocked(i, false)),
};

export const channelToolCommands: Command[] = [purge, slowmode, lock, unlock];
