import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../commands/types";
import { finishRaid, raidStatus } from "./service";

const NO_MENTIONS = { parse: [] as never[] };

// /raid status shows whether raid mode is on; /raid end switches it off early. Moderators and admins (enforced in code).
const raid: Command = {
  data: new SlashCommandBuilder()
    .setName("raid")
    .setDescription("Raid protection (moderators)")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("status").setDescription("Is raid mode on, and how many accounts joined lately?"))
    .addSubcommand((s) => s.setName("end").setDescription("Switch raid mode off now"))
    .toJSON(),
  requires: "moderator",
  async execute(i) {
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    if (i.options.getSubcommand() === "end") {
      return void (await reply((await finishRaid(`Ended by ${i.user.username}.`)) ? "Raid mode is off." : "Raid mode wasn't on."));
    }
    const s = await raidStatus();
    if (!s.enabled) return void (await reply("Raid protection is switched off."));
    const lines = [s.activeUntil ? `🚨 Raid mode is **on** until <t:${Math.floor(s.activeUntil.getTime() / 1000)}:t> (<t:${Math.floor(s.activeUntil.getTime() / 1000)}:R>).` : "Raid mode is off.", `Joins in the last ${s.windowSeconds} seconds: ${s.recentJoins} (a raid is ${s.threshold}).`];
    await reply(lines.join("\n"));
  },
};

export const raidCommands: Command[] = [raid];
