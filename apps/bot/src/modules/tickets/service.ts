import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Guild,
  type ModalSubmitInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";
import type { Ticket, TicketConfig } from "@aboutselphy/db";
import type { TicketPanelStatus } from "@aboutselphy/shared";
import { fillTicketTemplate, ticketChannelName } from "@aboutselphy/shared/tickets";
import { withEmotes } from "../../lib/emotes";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { env } from "../../lib/env";
import { escapeText, truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { staffLevel } from "../../lib/permissions";
import { toComponentEmoji } from "../roles";
import { getTicketConfig } from "./config";
import { buildTranscript, cleanReason, idleCutoff, OPEN_CONTROL_ID, openCategoryControlId, parentFor, rateControlId, staffRolesFor, starsText, ticketControlId, ticketOverwrites, transcriptToText, type RawMessage } from "./plan";
import { claim, createTicket, findByChannel, findCategory, listCategories, listIdle, listOpen, listRecentlyClosed, claimedCountFor, markClosed, openCountFor, reserveNumber, setPanelMessage, touchActivity } from "./repository";

const NO_MENTIONS = { parse: [] as never[] };
const openLocks = new KeyedMutex();
const DELETE_DELAY_MS = 10_000;
const FETCH_CAP = 2000;

/** Staff = one of the ticket staff roles, or a staff member of the bot (the same roles as the dashboard). */
export function isTicketStaff(member: GuildMember, config: TicketConfig, category: { staffRoleIds: readonly string[] } | null = null): boolean {
  return staffRolesFor(config.staffRoleIds, category).some((id) => member.roles.cache.has(id)) || staffLevel(member) !== null;
}

const asText = async (guild: Guild, id: string | null): Promise<GuildTextBasedChannel | null> => {
  if (!id) return null;
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel && !channel.isDMBased() && channel.guildId === guild.id && channel.isTextBased() ? (channel as GuildTextBasedChannel) : null;
};

// -- the panel ------------------------------------------------------------------------------------

export async function postPanel(guild: Guild): Promise<TicketPanelStatus> {
  try {
    const config = await getTicketConfig();
    if (!config.panelChannelId || !config.categoryId || config.staffRoleIds.length === 0) return "needsSetup";
    const channel = await asText(guild, config.panelChannelId);
    if (!channel || !("send" in channel)) return "channel";

    const embed = new EmbedBuilder().setColor(config.panelColor).setTitle(truncate(withEmotes(config.panelTitle), 256));
    if (config.panelDescription) embed.setDescription(truncate(withEmotes(config.panelDescription), 4000));
    // One button per category when there are any (a row holds five), otherwise the single button.
    const categories = (await listCategories()).slice(0, 5);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      categories.length > 0
        ? categories.map((c) => {
            const button = new ButtonBuilder().setCustomId(openCategoryControlId(c.id)).setLabel(truncate(c.label, 80)).setStyle(ButtonStyle.Primary);
            const emoji = toComponentEmoji(c.emoji);
            return emoji ? button.setEmoji(emoji) : button;
          })
        : [new ButtonBuilder().setCustomId(OPEN_CONTROL_ID).setLabel(truncate(config.buttonLabel, 80)).setStyle(ButtonStyle.Primary).setEmoji("🎫")],
    );
    const payload = { embeds: [embed], components: [row], allowedMentions: NO_MENTIONS };

    if (config.panelMessageId) {
      const existing = await channel.messages.fetch(config.panelMessageId).catch(() => null);
      if (existing && channel.id === config.panelChannelId) {
        await existing.edit(payload);
        return "updated";
      }
    }
    const message = await channel.send(payload);
    await setPanelMessage(channel.id, message.id);
    log.info({ channelId: channel.id, messageId: message.id }, "ticket panel posted");
    return "posted";
  } catch (err) {
    log.error({ err }, "posting the ticket panel failed");
    return "failed";
  }
}

// -- opening ----------------------------------------------------------------------------------------

/** "Open a ticket" was pressed, or the form asking what it is about was sent. Serialised per member so a double click can't make two. */
export function openTicket(i: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">, reason = "", categoryId: string | null = null): Promise<void> {
  return openLocks.run(i.user.id, async () => {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const say = (content: string) => i.editReply({ content, allowedMentions: NO_MENTIONS });
    const config = await getTicketConfig();
    if (!config.enabled || !config.categoryId || config.staffRoleIds.length === 0) return void (await say("Tickets aren't open right now."));

    const open = await openCountFor(i.user.id);
    if (open >= config.maxOpenPerUser) return void (await say(open === 1 ? "You already have an open ticket. Please use that one." : `You already have ${open} open tickets, which is the most allowed.`));

    // A category button: the category must still exist; its own roles and Discord category apply when it has them.
    const ticketCategory = categoryId ? await findCategory(categoryId) : null;
    if (categoryId && !ticketCategory) return void (await say("That ticket type isn't available any more. Please use the current panel."));
    const staffRoleIds = staffRolesFor(config.staffRoleIds, ticketCategory);
    const category = await i.guild.channels.fetch(parentFor(config.categoryId, ticketCategory) ?? config.categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) return void (await say("The ticket category is missing. Please tell a moderator."));
    const me = i.guild.members.me ?? (await i.guild.members.fetchMe());
    const perms = category.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.ManageChannels) || !perms.has(PermissionFlagsBits.ViewChannel)) {
      log.warn({ categoryId: category.id }, "tickets: the bot can't manage channels in the ticket category");
      return void (await say("I can't create ticket channels right now. Please tell a moderator."));
    }

    let channel;
    try {
      const number = await reserveNumber();
      channel = await i.guild.channels.create({
        name: ticketChannelName(number),
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Ticket #${number} · opened by ${i.user.id}`,
        permissionOverwrites: ticketOverwrites({ everyoneId: i.guild.id, openerId: i.user.id, botId: me.id, staffRoleIds }),
        reason: `Ticket #${number} opened by ${i.user.username}`,
      });
      const topic = cleanReason(reason);
      const ticket = await createTicket({ number, channelId: channel.id, openerId: i.user.id, openerName: i.member.displayName, topic, categoryId: ticketCategory?.id ?? null, categoryLabel: ticketCategory?.label ?? "" });
      rememberOpenChannel(channel.id);

      const welcome = new EmbedBuilder()
        .setColor(config.panelColor)
        .setTitle(`Ticket #${number}`)
        .setDescription(truncate(withEmotes(fillTicketTemplate(config.welcomeTemplate, { user: `<@${i.user.id}>`, number: String(number) })), 4000));
      // What they said it is about is theirs to write: shown as plain text, nothing in it can ping.
      if (ticketCategory) welcome.addFields({ name: "Type", value: truncate(escapeText(ticketCategory.label), 100), inline: true });
      if (topic) welcome.addFields({ name: "What it is about", value: truncate(escapeText(topic), 1000) });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(ticketControlId("claim", ticket.id)).setLabel("Claim").setStyle(ButtonStyle.Secondary).setEmoji("🙋"),
        new ButtonBuilder().setCustomId(ticketControlId("close", ticket.id)).setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒"),
      );
      // Only the opener is pinged; the staff roles can see the channel and are not mentioned.
      await channel.send({ content: `<@${i.user.id}>`, embeds: [welcome], components: [row], allowedMentions: { parse: [], users: [i.user.id] } });
      log.info({ number, opener: i.user.id, channelId: channel.id }, "ticket opened");
      await say(`Your ticket is ready: <#${channel.id}>`);
    } catch (err) {
      log.error({ err, user: i.user.id }, "opening a ticket failed");
      if (channel) await channel.delete("Ticket could not be recorded").catch(() => undefined);
      await say("Something went wrong opening your ticket. Please try again, or tell a moderator.");
    }
  });
}

// -- claiming -----------------------------------------------------------------------------------------

export async function claimTicket(i: ButtonInteraction<"cached">, ticket: Ticket): Promise<string> {
  if (ticket.status !== "open") return "This ticket is closed.";
  const limit = (await getTicketConfig()).maxClaimsPerStaff;
  if (limit > 0 && !ticket.claimedById && (await claimedCountFor(i.user.id)) >= limit) return `You already have ${limit} ${limit === 1 ? "ticket" : "tickets"} claimed. Close one first.`;
  if (!(await claim(ticket.id, { id: i.user.id, name: i.member.displayName }))) return ticket.claimedById ? `This ticket is already claimed by <@${ticket.claimedById}>.` : "This ticket can't be claimed.";
  const channel = i.channel;
  if (channel && "send" in channel) await channel.send({ content: `🙋 <@${i.user.id}> is handling this ticket.`, allowedMentions: { parse: [], users: [i.user.id] } }).catch(() => undefined);
  log.info({ ticket: ticket.number, by: i.user.id }, "ticket claimed");
  return "You claimed this ticket.";
}

// -- closing ---------------------------------------------------------------------------------------------

async function fetchMessages(channel: GuildTextBasedChannel): Promise<{ raw: RawMessage[]; total: number } | null> {
  // Without the MessageContent intent the text would come back empty, so don't pretend to have a transcript.
  if (!env().DISCORD_MESSAGE_CONTENT) return null;
  const raw: RawMessage[] = [];
  let before: string | undefined;
  let total = 0;
  while (total < FETCH_CAP + 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (batch.size === 0) break;
    for (const m of batch.values() as Iterable<Message>) {
      total++;
      raw.push({
        id: m.id,
        authorId: m.author.id,
        authorName: m.member?.displayName ?? m.author.username,
        authorBot: m.author.bot,
        at: m.createdAt,
        content: m.content,
        attachments: [...m.attachments.values()].map((a) => ({ name: a.name ?? "file", url: a.url })),
        embeds: m.embeds.length,
      });
    }
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return { raw, total };
}

/**
 * Closes a ticket: marks it closed (once), saves the transcript if the bot can read text, posts a summary and the transcript
 * to the log channel, and deletes the channel after a short pause.
 */
export async function closeTicket(guild: Guild, ticket: Ticket, by: { id: string; name: string } | null, reason: string): Promise<boolean> {
  const channel = await asText(guild, ticket.channelId);
  const fetched = channel ? await fetchMessages(channel).catch((err) => (log.error({ err, ticket: ticket.number }, "reading the ticket messages failed"), null)) : null;
  const transcript = fetched ? buildTranscript(fetched.raw, fetched.total) : null;

  // The conditional update decides who closes it: a second click does nothing.
  const closed = await markClosed(ticket.id, { closedById: by?.id ?? null, closedByName: by?.name ?? null, closeReason: reason, transcript: transcript as never, messageCount: transcript?.messages.length ?? 0 });
  if (!closed) return false;
  log.info({ ticket: ticket.number, by: by?.id ?? "system", messages: transcript?.messages.length ?? null }, "ticket closed");

  // The opener can still read, but no longer write, while this finishes.
  if (channel && "permissionOverwrites" in channel) await channel.permissionOverwrites.edit(ticket.openerId, { SendMessages: false }, { reason: "Ticket closed" }).catch(() => undefined);

  const config = await getTicketConfig();
  const logChannel = await asText(guild, config.logChannelId);
  if (logChannel && "send" in logChannel) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle(`Ticket #${ticket.number} closed`)
        .addFields(
          { name: "Opened by", value: `<@${ticket.openerId}> (${escapeText(ticket.openerName)})`, inline: true },
          { name: "Closed by", value: by ? `<@${by.id}>` : "automatically", inline: true },
          { name: "Claimed by", value: ticket.claimedById ? `<@${ticket.claimedById}>` : "nobody", inline: true },
          { name: "Messages", value: transcript ? String(transcript.messages.length) : "not saved (the bot can't read message text)", inline: true },
        )
        .setTimestamp();
      if (reason) embed.addFields({ name: "Reason", value: escapeText(truncate(reason, 300)) });
      const files = transcript ? [new AttachmentBuilder(Buffer.from(transcriptToText(transcript, `Ticket #${ticket.number} · ${ticket.openerName}`), "utf8"), { name: `ticket-${ticket.number}.txt` })] : [];
      await logChannel.send({ embeds: [embed], files, allowedMentions: NO_MENTIONS });
    } catch (err) {
      log.error({ err, ticket: ticket.number }, "posting the ticket summary failed");
    }
  }

  // Ask the opener how it went (best effort: closed DMs just mean no rating).
  if (config.askRating) {
    const opener = await guild.client.users.fetch(ticket.openerId).catch(() => null);
    if (opener) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents([1, 2, 3, 4, 5].map((n) => new ButtonBuilder().setCustomId(rateControlId(ticket.id, n)).setLabel(String(n)).setEmoji("⭐").setStyle(ButtonStyle.Secondary)));
      await opener.send({ content: `Your ticket #${ticket.number} in **${escapeText(guild.name)}** was closed. How was the help you got?`, components: [row], allowedMentions: NO_MENTIONS }).catch(() => undefined);
    }
  }

  if (channel && "send" in channel) {
    await channel.send({ content: `🔒 Ticket closed. This channel will be deleted in ${DELETE_DELAY_MS / 1000} seconds.`, allowedMentions: NO_MENTIONS }).catch(() => undefined);
    setTimeout(() => void channel.delete(`Ticket #${ticket.number} closed`).catch((err) => log.warn({ err, ticket: ticket.number }, "could not delete the ticket channel")), DELETE_DELAY_MS).unref();
  }
  return true;
}

/** A ticket channel deleted by hand: the ticket is closed (without a transcript) so it stops counting as open. */
export async function onTicketChannelDeleted(channelId: string): Promise<void> {
  const ticket = await findByChannel(channelId);
  if (!ticket || ticket.status !== "open") return;
  await markClosed(ticket.id, { closedById: null, closedByName: null, closeReason: "Channel was deleted", transcript: null, messageCount: 0 });
  log.info({ ticket: ticket.number }, "ticket closed: its channel was deleted");
}

/** After a restart: open tickets whose channel is gone are closed, and closed ones whose channel is still there are cleaned up. */
export async function reconcileTickets(guild: Guild): Promise<void> {
  await guild.channels.fetch();
  for (const ticket of await listOpen()) {
    if (!guild.channels.cache.has(ticket.channelId)) await onTicketChannelDeleted(ticket.channelId);
  }
  for (const ticket of await listRecentlyClosed(new Date(Date.now() - 86_400_000))) {
    const channel = guild.channels.cache.get(ticket.channelId);
    if (channel) await channel.delete(`Ticket #${ticket.number} was closed`).catch(() => undefined);
  }
}

// -- activity and idle tickets ----------------------------------------------------------------------------

// Which channels are open tickets, refreshed every minute and when one opens, so a message anywhere in the server
// doesn't cost a database query. A write per ticket per minute at most.
const CHANNEL_TTL_MS = 60_000;
const WRITE_EVERY_MS = 60_000;
let openChannels: { ids: Set<string>; at: number } | undefined;
const lastWrite = new Map<string, number>();

export const rememberOpenChannel = (channelId: string) => openChannels?.ids.add(channelId);

async function isOpenTicketChannel(channelId: string): Promise<boolean> {
  if (!openChannels || Date.now() - openChannels.at > CHANNEL_TTL_MS) openChannels = { ids: new Set((await listOpen()).map((t) => t.channelId)), at: Date.now() };
  return openChannels.ids.has(channelId);
}

/** A person wrote in a channel: if it is an open ticket, it is not idle. */
export async function noteTicketActivity(channelId: string): Promise<void> {
  if (!(await isOpenTicketChannel(channelId))) return;
  const now = Date.now();
  if (now - (lastWrite.get(channelId) ?? 0) < WRITE_EVERY_MS) return;
  lastWrite.set(channelId, now);
  await touchActivity(channelId);
}

/** Closes the tickets that have had no message for the configured number of hours (0 = never). */
export async function closeIdleTickets(guild: Guild): Promise<void> {
  const config = await getTicketConfig();
  if (!config.enabled) return;
  const cut = idleCutoff(config.autoCloseHours, new Date());
  if (!cut) return;
  for (const ticket of await listIdle(cut)) {
    log.info({ ticket: ticket.number, hours: config.autoCloseHours }, "tickets: closing an idle ticket");
    await closeTicket(guild, ticket, null, `Closed automatically after ${config.autoCloseHours} hours without a message`).catch((err) => log.error({ err, ticket: ticket.number }, "tickets: closing an idle ticket failed"));
  }
}
