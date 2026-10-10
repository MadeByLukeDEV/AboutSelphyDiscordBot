import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type SlashCommandSubcommandBuilder } from "discord.js";
import { MAX_DECISION_REASON, MAX_SUGGESTION } from "@aboutselphy/shared/suggestions";
import type { Command } from "../../commands/types";
import { findByNumber } from "./repository";
import { decideSuggestion, submitSuggestion } from "./service";

const NO_MENTIONS = { parse: [] as never[] };

const suggest: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Share an idea with the team and let everyone vote on it")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName("idea").setDescription("Your suggestion").setRequired(true).setMinLength(5).setMaxLength(MAX_SUGGESTION))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await submitSuggestion(i.guild, { id: i.user.id, name: i.member.displayName }, i.options.getString("idea", true));
    await i.editReply({ content: result.ok ? `Thanks! Your suggestion is #${result.number}: https://discord.com/channels/${i.guildId}/${result.channelId}/${result.messageId}` : result.message, allowedMentions: NO_MENTIONS });
  },
};

const suggestion: Command = {
  data: new SlashCommandBuilder()
    .setName("suggestion")
    .setDescription("Decide on a suggestion (team)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) => decisionOptions(s.setName("approve").setDescription("Approve a suggestion")))
    .addSubcommand((s) => decisionOptions(s.setName("deny").setDescription("Deny a suggestion")))
    .addSubcommand((s) => decisionOptions(s.setName("implement").setDescription("Mark a suggestion as implemented")))
    .toJSON(),
  requires: "moderator",
  async execute(i) {
    if (!i.inCachedGuild()) return;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const found = await findByNumber(i.options.getInteger("number", true));
    if (!found) return void (await i.editReply({ content: "There is no suggestion with that number." }));
    const sub = i.options.getSubcommand();
    const status = sub === "approve" ? "approved" : sub === "deny" ? "denied" : "implemented";
    const outcome = await decideSuggestion(i.guild, found.id, status, i.options.getString("reason") ?? "", { id: i.user.id, name: i.member.displayName });
    const text = outcome === "done" ? `Suggestion #${found.number} is now ${status}.` : outcome === "wrong-state" ? "That suggestion can't be changed to that any more." : "That didn't work. Try again.";
    await i.editReply({ content: text, allowedMentions: NO_MENTIONS });
  },
};

function decisionOptions(s: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return s
    .addIntegerOption((o) => o.setName("number").setDescription("The suggestion's number").setRequired(true).setMinValue(1))
    .addStringOption((o) => o.setName("reason").setDescription("Why (the author is told)").setMaxLength(MAX_DECISION_REASON));
}

export const suggestionCommands: Command[] = [suggest, suggestion];
