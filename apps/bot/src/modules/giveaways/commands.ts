import { ChannelType, InteractionContextType, MessageFlags, SlashCommandBuilder, type AutocompleteInteraction } from "discord.js";
import { parseDuration } from "@aboutselphy/shared/duration";
import { MAX_PRIZE, MAX_REPEATS, MAX_WINNERS } from "@aboutselphy/shared/giveaways";
import type { Command } from "../../commands/types";
import { truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { createFromCommand, listActive, listEnded } from "./repository";
import { cancelGiveaway, endGiveaway, startGiveaway } from "./service";

const NO_MENTIONS = { parse: [] as never[] };
// A giveaway may last from five minutes to a year (the same limits as the dashboard's form).
const MIN_SECONDS = 5 * 60;
const MAX_SECONDS = 366 * 86_400;

const pick = (name: string) => (o: import("discord.js").SlashCommandStringOption) => o.setName(name).setDescription("Which giveaway (pick from the list)").setRequired(true).setAutocomplete(true);

// /giveaway: the team can run a giveaway without opening the dashboard. Creating goes through the same start path as the
// dashboard (the bot posts the Enter button); end, re-roll and cancel pick from the lists the bot offers.
const giveaway: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Run giveaways (moderators)")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("start")
        .setDescription("Start a giveaway")
        .addStringOption((o) => o.setName("prize").setDescription("What can be won").setRequired(true).setMaxLength(MAX_PRIZE))
        .addStringOption((o) => o.setName("duration").setDescription("How long, e.g. 30m, 2h, 3d").setRequired(true).setMaxLength(12))
        .addIntegerOption((o) => o.setName("winners").setDescription("How many winners (default 1)").setMinValue(1).setMaxValue(MAX_WINNERS))
        .addChannelOption((o) => o.setName("channel").setDescription("Where to post it (default: here)").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addRoleOption((o) => o.setName("role").setDescription("Only members with this role can enter"))
        .addIntegerOption((o) => o.setName("repeat").setDescription("Run this many more rounds after the first").setMinValue(1).setMaxValue(MAX_REPEATS)),
    )
    .addSubcommand((s) => s.setName("end").setDescription("End a running giveaway now and draw the winners").addStringOption(pick("giveaway")))
    .addSubcommand((s) => s.setName("reroll").setDescription("Draw new winners for an ended giveaway").addStringOption(pick("giveaway")))
    .addSubcommand((s) => s.setName("cancel").setDescription("Cancel a giveaway without a draw").addStringOption(pick("giveaway")))
    .toJSON(),
  requires: "moderator",
  async autocomplete(i: AutocompleteInteraction) {
    const rows = i.options.getSubcommand() === "reroll" ? await listEnded() : await listActive();
    const typed = String(i.options.getFocused()).toLowerCase();
    await i.respond(rows.filter((g) => g.prize.toLowerCase().includes(typed)).slice(0, 25).map((g) => ({ name: truncate(`${g.prize} (${g.winnerCount} ${g.winnerCount === 1 ? "winner" : "winners"})`, 100), value: g.id })));
  },
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    const sub = i.options.getSubcommand();

    if (sub === "start") {
      const seconds = parseDuration(i.options.getString("duration", true));
      if (seconds === null || seconds < MIN_SECONDS || seconds > MAX_SECONDS) return void (await reply("Pick a length between 5 minutes and a year, e.g. `30m`, `2h` or `3d`."));
      const prize = i.options.getString("prize", true).trim();
      if (!prize) return void (await reply("Say what can be won."));
      const channel = i.options.getChannel("channel") ?? i.channel;
      if (!channel || !("send" in channel)) return void (await reply("I can't post in that channel."));
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const row = await createFromCommand({
        channelId: channel.id,
        prize,
        winnerCount: i.options.getInteger("winners") ?? 1,
        endsAt: new Date(Date.now() + seconds * 1000),
        requiredRoleId: i.options.getRole("role")?.id ?? null,
        repeatsLeft: i.options.getInteger("repeat") ?? 0,
        hostName: i.member.displayName,
        hostUserId: i.user.id,
      });
      const status = await startGiveaway(i.guild, row.id);
      log.info({ giveaway: row.id, by: i.user.id, status }, "giveaway: started from the command");
      return void (await i.editReply({ content: status === "done" ? `Giveaway started in <#${channel.id}>.` : status === "channel" ? "I can't post in that channel. Check my permissions there." : "I couldn't start it. It is saved as a draft on the dashboard.", allowedMentions: NO_MENTIONS }));
    }

    const id = i.options.getString("giveaway", true);
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (sub === "cancel") {
      const status = await cancelGiveaway(i.guild, id);
      return void (await i.editReply({ content: status === "done" ? "Cancelled. Nobody won." : status === "not-found" ? "I can't find that giveaway." : "That giveaway can't be cancelled (it is already over)." }));
    }
    const result = await endGiveaway(i.guild, id, sub === "reroll");
    const text = result.status === "done" ? (result.winners?.length ? `Drawn: ${result.winners.map((w) => `<@${w}>`).join(", ")}` : "Drawn, but there were no valid entries.") : result.status === "not-found" ? "I can't find that giveaway." : result.status === "wrong-state" ? (sub === "reroll" ? "Only an ended giveaway can be re-rolled." : "That giveaway isn't running.") : "Something went wrong. Try again.";
    await i.editReply({ content: text, allowedMentions: NO_MENTIONS });
  },
};

export const giveawayCommands: Command[] = [giveaway];

