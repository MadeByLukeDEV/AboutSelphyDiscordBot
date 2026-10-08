import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { prisma } from "@aboutselphy/db";
import type { Command } from "./types";

export const ping: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check that the bot is alive (gateway and database latency)")
    .setContexts(0) // guild only
    .toJSON(),
  requires: "moderator",
  async execute(interaction) {
    const started = Date.now();
    let dbMs: number | null = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbMs = Date.now() - started;
    } catch {
      // reported below; details stay in the server log
    }
    const gateway = interaction.client.ws.ping;
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: [
        "Pong!",
        `Gateway: ${gateway >= 0 ? `${gateway} ms` : "n/a"}`,
        `Database: ${dbMs === null ? "unreachable" : `${dbMs} ms`}`,
      ].join("\n"),
    });
  },
};
