import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction } from "discord.js";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { getTicketConfig } from "./config";
import { canClaim, canClose, parseTicketControl, ticketControlId, TICKET_PREFIX } from "./plan";
import { findTicket } from "./repository";
import { claimTicket, closeTicket, isTicketStaff, openTicket } from "./service";

const NO_MENTIONS = { parse: [] as never[] };

/**
 * Every ticket button lands here. Nothing is trusted from the interaction: the custom id is parsed
 * strictly, the ticket is read from our table, it must be pressed inside its own channel, and the
 * person must be the opener or staff (read from their roles now) for what they ask. A button copied
 * into another channel, or pressed by a bystander, does nothing.
 */
async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID || !i.isButton()) return;
  const button: ButtonInteraction<"cached"> = i;
  const control = parseTicketControl(button.customId);
  if (!control) return void (await button.reply({ content: "That control isn't valid any more.", flags: MessageFlags.Ephemeral }));

  if (control.action === "open") return openTicket(button);

  const ticket = await findTicket(control.ticketId);
  if (!ticket || ticket.status !== "open" || ticket.channelId !== button.channelId) {
    return void (await button.reply({ content: "This ticket isn't active any more.", flags: MessageFlags.Ephemeral }));
  }
  const config = await getTicketConfig();
  const who = { isStaff: isTicketStaff(button.member, config), isOpener: button.user.id === ticket.openerId };

  if (control.action === "claim") {
    if (!canClaim(who)) return void (await button.reply({ content: "Only the team can claim a ticket.", flags: MessageFlags.Ephemeral }));
    return void (await button.reply({ content: await claimTicket(button, ticket), flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS }));
  }

  if (!canClose(who)) return void (await button.reply({ content: "Only the person who opened this ticket or the team can close it.", flags: MessageFlags.Ephemeral }));

  if (control.action === "close") {
    // Ask first: a stray click shouldn't delete a conversation.
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(ticketControlId("confirm", ticket.id)).setLabel("Yes, close it").setStyle(ButtonStyle.Danger));
    return void (await button.reply({ content: "Close this ticket? The conversation is saved for the team and this channel is deleted.", components: [row], flags: MessageFlags.Ephemeral }));
  }

  // confirm
  await button.update({ content: "Closing…", components: [] });
  const closed = await closeTicket(button.guild, ticket, { id: button.user.id, name: button.member.displayName }, "");
  if (!closed) await button.followUp({ content: "This ticket was already closed.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
}

export function registerTicketControls(): void {
  onComponent(TICKET_PREFIX, async (i) => {
    try {
      await handle(i);
    } catch (err) {
      log.error({ err, user: i.user.id }, "ticket interaction failed");
      throw err; // the router answers the member with a generic message
    }
  });
}
