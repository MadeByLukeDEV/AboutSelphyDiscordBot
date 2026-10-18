import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { isStatGame, STAT_GAMES, type StatGame } from "@aboutselphy/shared/games";
import type { Command } from "../../commands/types";
import { escapeText, truncate } from "../../lib/escape";
import { coinflip, eightBall, rollDie } from "./logic";
import { readConfig, statsOf, topPlayers } from "./repository";
import { startDuel, startRps, startTrivia } from "./service";

const NO_MENTIONS = { parse: [] as never[] };
const TITLES: Record<StatGame, string> = { trivia: "🧠 Trivia", rps: "✊ Rock paper scissors", tictactoe: "❌ Tic-tac-toe", connect4: "🔴 Connect four" };
const MEDALS = ["🥇", "🥈", "🥉"];

const game: Command = {
  data: new SlashCommandBuilder()
    .setName("game")
    .setDescription("Play a minigame")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("trivia").setDescription("A trivia question everyone in the channel can answer"))
    .addSubcommand((s) =>
      s
        .setName("rps")
        .setDescription("Rock paper scissors against a member, or against the bot")
        .addUserOption((o) => o.setName("opponent").setDescription("Who to play (leave empty to play the bot)")),
    )
    .addSubcommand((s) =>
      s
        .setName("tictactoe")
        .setDescription("Tic-tac-toe against another member")
        .addUserOption((o) => o.setName("opponent").setDescription("Who to play").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("connect4")
        .setDescription("Connect four against another member")
        .addUserOption((o) => o.setName("opponent").setDescription("Who to play").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("coinflip").setDescription("Flip a coin"))
    .addSubcommand((s) =>
      s
        .setName("dice")
        .setDescription("Roll a die")
        .addIntegerOption((o) => o.setName("sides").setDescription("How many sides (default 6)").setMinValue(2).setMaxValue(1000)),
    )
    .addSubcommand((s) =>
      s
        .setName("8ball")
        .setDescription("Ask the magic 8-ball a yes or no question")
        .addStringOption((o) => o.setName("question").setDescription("Your question").setRequired(true).setMaxLength(200)),
    )
    .addSubcommand((s) =>
      s
        .setName("stats")
        .setDescription("Your game record, or another member's")
        .addUserOption((o) => o.setName("member").setDescription("Whose record (default: yours)")),
    )
    .addSubcommand((s) =>
      s
        .setName("top")
        .setDescription("The best players")
        .addStringOption((o) => o.setName("game").setDescription("Which game (default: all together)").addChoices(...STAT_GAMES.map((g) => ({ name: g, value: g })))),
    )
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const sub = i.options.getSubcommand();

    if (sub === "trivia") return startTrivia(i);
    if (sub === "rps") return startRps(i);
    if (sub === "tictactoe") return startDuel(i, "t");
    if (sub === "connect4") return startDuel(i, "c");

    if (sub === "coinflip" || sub === "dice" || sub === "8ball") {
      if (!(await readConfig()).funOn) return void (await i.reply({ content: "Those games are switched off right now.", flags: MessageFlags.Ephemeral }));
      if (sub === "coinflip") return void (await i.reply({ content: `🪙 **${coinflip(Math.random)}**`, allowedMentions: NO_MENTIONS }));
      if (sub === "dice") {
        const sides = i.options.getInteger("sides") ?? 6;
        return void (await i.reply({ content: `🎲 d${sides}: **${rollDie(sides, Math.random)}**`, allowedMentions: NO_MENTIONS }));
      }
      const question = escapeText(truncate(i.options.getString("question", true), 200));
      return void (await i.reply({ content: `🎱 *${question}*\n**${eightBall(Math.random)}**`, allowedMentions: NO_MENTIONS }));
    }

    if (sub === "stats") {
      const user = i.options.getUser("member") ?? i.user;
      const rows = await statsOf(user.id);
      if (rows.length === 0) return void (await i.reply({ content: `${user.id === i.user.id ? "You haven't" : "They haven't"} played any games yet. Try \`/game trivia\`.`, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS }));
      const lines = rows.filter((r) => isStatGame(r.game)).map((r) => `${TITLES[r.game as StatGame]}: **${r.wins}** won · ${r.draws} drawn · ${r.played} played`);
      const embed = new EmbedBuilder().setColor(0x00ffa8).setTitle(`Game record of ${escapeText(truncate(user.displayName, 40))}`).setDescription(lines.join("\n"));
      return void (await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS }));
    }

    // top
    const chosen = i.options.getString("game");
    const which = chosen && isStatGame(chosen) ? chosen : null;
    const rows = await topPlayers(which, 10);
    if (rows.length === 0) return void (await i.reply({ content: "Nobody has won a game yet. Be the first!", flags: MessageFlags.Ephemeral }));
    const lines = rows.map((r, n) => `${MEDALS[n] ?? `${n + 1}.`} **${escapeText(truncate(r.name || "player", 40))}** · ${r.wins} ${r.wins === 1 ? "win" : "wins"} in ${r.played} played`);
    const embed = new EmbedBuilder().setColor(0x00ffa8).setTitle(which ? `${TITLES[which]} · top players` : "Minigames · top players").setDescription(lines.join("\n"));
    await i.reply({ embeds: [embed], allowedMentions: NO_MENTIONS });
  },
};

export const gameCommands: Command[] = [game];
