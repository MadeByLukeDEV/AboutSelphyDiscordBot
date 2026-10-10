import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { parseDuration } from "@aboutselphy/shared/duration";
import { MAX_OPTION, MAX_OPTIONS, MAX_QUESTION, MIN_OPTIONS, parseOptions } from "@aboutselphy/shared/polls";
import type { Command } from "../../commands/types";
import { create } from "./repository";
import { startPoll } from "./service";

const NO_MENTIONS = { parse: [] as never[] };
const MAX_DURATION_SECONDS = 30 * 86_400;

const poll: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Start a poll in this channel (team)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((o) => o.setName("question").setDescription("What to ask").setRequired(true).setMaxLength(MAX_QUESTION))
    .addStringOption((o) => o.setName("options").setDescription(`${MIN_OPTIONS} to ${MAX_OPTIONS} options separated by | (e.g. Pizza | Pasta | Salad)`).setRequired(true).setMaxLength(MAX_OPTIONS * (MAX_OPTION + 3)))
    .addStringOption((o) => o.setName("duration").setDescription("How long it runs, e.g. 1h or 2d (empty = until a team member ends it)").setMaxLength(12))
    .addBooleanOption((o) => o.setName("multiple").setDescription("Members may choose several options"))
    .toJSON(),
  requires: "moderator",
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    const options = parseOptions(i.options.getString("options", true));
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return void (await reply(`Give ${MIN_OPTIONS} to ${MAX_OPTIONS} different options separated by |.`));
    if (options.some((o) => o.length > MAX_OPTION)) return void (await reply(`Each option can be at most ${MAX_OPTION} characters.`));

    let endsAt: Date | null = null;
    const rawDuration = i.options.getString("duration");
    if (rawDuration) {
      const seconds = parseDuration(rawDuration);
      if (seconds === null || seconds < 60 || seconds > MAX_DURATION_SECONDS) return void (await reply("The duration must be between 1 minute and 30 days, e.g. `1h` or `2d`."));
      endsAt = new Date(Date.now() + seconds * 1000);
    }
    if (!i.channel || i.channel.isDMBased()) return void (await reply("Use this in a server channel."));

    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const created = await create({ channelId: i.channelId, question: i.options.getString("question", true).trim(), options, multiple: i.options.getBoolean("multiple") ?? false, endsAt, createdById: i.user.id, createdByName: i.member.displayName });
    const status = await startPoll(i.guild, created.id);
    await i.editReply({ content: status === "done" ? "Poll started." : status === "channel" ? "I can't post in this channel." : "Couldn't start the poll. Try again.", allowedMentions: NO_MENTIONS });
  },
};

export const pollCommands: Command[] = [poll];
