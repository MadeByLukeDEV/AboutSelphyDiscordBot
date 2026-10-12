import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../commands/types";
import { staffLevel } from "../../lib/permissions";
import { statsFor } from "./repository";
import { statsLine } from "./rules";

// /invites: how many people joined through a member's invites. Everyone can look at their own; looking at someone else's is
// for staff (it says who brought whom).
const invites: Command = {
  data: new SlashCommandBuilder()
    .setName("invites")
    .setDescription("How many members joined through your invites")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("member").setDescription("Staff only: look at someone else"))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const target = i.options.getUser("member");
    if (target && target.id !== i.user.id && staffLevel(i.member) === null) {
      return void (await i.reply({ content: "Only staff can look at other members' invites.", flags: MessageFlags.Ephemeral }));
    }
    const who = target ?? i.user;
    const stats = await statsFor(who.id);
    await i.reply({ content: `${who.id === i.user.id ? "You" : `<@${who.id}>`}: ${statsLine(stats)}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  },
};

export const inviteCommands: Command[] = [invites];
