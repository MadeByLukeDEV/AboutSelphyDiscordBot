import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../commands/types";
import { escapeText } from "../../lib/escape";
import { getTicketConfig } from "./config";
import { findByChannel } from "./repository";
import { isTicketStaff } from "./service";

const NO_MENTIONS = { parse: [] as never[] };

const ticket: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage the ticket you are in (team only)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) => s.setName("add").setDescription("Let someone else into this ticket").addUserOption((o) => o.setName("user").setDescription("Who").setRequired(true)))
    .addSubcommand((s) => s.setName("remove").setDescription("Take someone out of this ticket").addUserOption((o) => o.setName("user").setDescription("Who").setRequired(true)))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    const config = await getTicketConfig();
    if (!isTicketStaff(i.member, config)) return void (await reply("Only the team can do that."));
    const found = await findByChannel(i.channelId);
    if (!found || found.status !== "open") return void (await reply("Use this inside an open ticket."));
    const channel = i.channel;
    if (!channel || !("permissionOverwrites" in channel)) return void (await reply("That doesn't work here."));

    const user = i.options.getUser("user", true);
    if (user.bot) return void (await reply("Bots can't be added to tickets."));
    if (i.options.getSubcommand() === "add") {
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true }, { reason: `Added to ticket by ${i.user.username}` });
      return void (await reply(`Added <@${user.id}> to this ticket.`));
    }
    if (user.id === found.openerId) return void (await reply("The person who opened the ticket can't be removed. Close the ticket instead."));
    await channel.permissionOverwrites.delete(user.id, `Removed from ticket by ${i.user.username}`);
    return void (await reply(`Removed ${escapeText(user.username)} from this ticket.`));
  },
};

export const ticketCommands: Command[] = [ticket];
