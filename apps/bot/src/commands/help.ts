import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { env } from "../lib/env";
import { staffLevel } from "../lib/permissions";
import { chunkLines, helpLines, toEntry, visibleTo } from "../modules/utility/rules";
import type { Command } from "./types";

// /help lists what the member who asks may use: staff commands are hidden from everyone else. The
// command list is read when the command runs (not at import time), because it is built from this
// very list.
export const help: Command = {
  data: new SlashCommandBuilder().setName("help").setDescription("See what this bot can do for you").setContexts(InteractionContextType.Guild).toJSON(),
  async execute(i) {
    const { COMMANDS } = await import("./index");
    const level = staffLevel(i.inCachedGuild() ? i.member : null);
    const entries = visibleTo(
      COMMANDS.map((c) => toEntry(c.data, c.requires)),
      level,
    );
    const members = entries.filter((e) => e.requires === null);
    const staff = entries.filter((e) => e.requires !== null);
    const embed = new EmbedBuilder().setColor(0x00ffa8).setTitle("What I can do").setDescription("Type a slash to see every command with its options.");
    chunkLines(helpLines(members)).forEach((chunk, n) => embed.addFields({ name: n === 0 ? "For everyone" : "For everyone (continued)", value: chunk }));
    chunkLines(helpLines(staff)).forEach((chunk, n) => embed.addFields({ name: n === 0 ? "For the team" : "For the team (continued)", value: chunk }));
    // The public overview page, when the bot knows the dashboard's address.
    const base = env().DASHBOARD_URL;
    if (base) embed.addFields({ name: "More", value: `A full overview with explanations: ${new URL("/features", base).toString()}` });
    await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  },
};
