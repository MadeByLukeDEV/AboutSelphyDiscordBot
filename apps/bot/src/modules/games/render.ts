import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";
import { C4_COLS, c4Line, controlId, RPS_CHOICES, RPS_EMOJI, tttLine, type C4Grid, type Mark, type RpsChoice, type TriviaRound, type TttBoard } from "./logic";

// The messages of the games: pure builders from plain game state. Every name goes through escapeText, nothing can ping
// (the caller passes allowedMentions), and a finished game's buttons are disabled.

export type Player = { id: string; name: string };
const name = (p: Player) => escapeText(truncate(p.name, 32)) || "player";

const MARK_EMOJI: Record<Mark, string> = { X: "❌", O: "⭕" };
const DISC: Record<Mark, string> = { X: "🔴", O: "🟡" };

// ---- tic-tac-toe ----------------------------------------------------------------------------------------

export function tttMessage(g: { players: [Player, Player]; board: TttBoard; turn: 0 | 1; id: string }, result: Mark | "draw" | null) {
  const win = tttLine(g.board);
  const header = `${MARK_EMOJI.X} **${name(g.players[0])}** vs ${MARK_EMOJI.O} **${name(g.players[1])}**`;
  const status = result === "draw" ? "It's a draw!" : result ? `🏆 **${name(g.players[result === "X" ? 0 : 1])}** wins!` : `${MARK_EMOJI[g.turn === 0 ? "X" : "O"]} ${name(g.players[g.turn])}'s turn`;
  const rows = [0, 1, 2].map((r) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const mark = g.board[i]!;
      const winning = win?.cells.includes(i) ?? false;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(controlId("t", g.id, i))
          .setLabel(mark ? MARK_EMOJI[mark] : "​")
          .setStyle(winning ? ButtonStyle.Success : mark === "X" ? ButtonStyle.Danger : mark === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(result !== null || mark !== ""),
      );
    }
    return row;
  });
  return { content: `${header}\n${status}`, components: rows };
}

// ---- connect four ---------------------------------------------------------------------------------------

const NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];

export function c4Message(g: { players: [Player, Player]; grid: C4Grid; turn: 0 | 1; id: string }, result: Mark | "draw" | null) {
  const win = c4Line(g.grid);
  const winning = new Set((win?.cells ?? []).map(([r, c]) => `${r},${c}`));
  const board = g.grid
    .map((row, r) => row.map((cell, c) => (cell ? (winning.has(`${r},${c}`) ? (cell === "X" ? "❤️" : "💛") : DISC[cell]) : "⚫")).join(""))
    .join("\n");
  const header = `${DISC.X} **${name(g.players[0])}** vs ${DISC.O} **${name(g.players[1])}**`;
  const status = result === "draw" ? "It's a draw!" : result ? `🏆 **${name(g.players[result === "X" ? 0 : 1])}** wins!` : `${DISC[g.turn === 0 ? "X" : "O"]} ${name(g.players[g.turn])}'s turn`;
  const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>(), new ActionRowBuilder<ButtonBuilder>()];
  for (let c = 0; c < C4_COLS; c++) {
    const full = g.grid[0]![c] !== "";
    rows[c < 4 ? 0 : 1]!.addComponents(new ButtonBuilder().setCustomId(controlId("c", g.id, c)).setLabel(String(c + 1)).setStyle(ButtonStyle.Secondary).setDisabled(result !== null || full));
  }
  return { content: `${header}\n${NUMBERS.join("")}\n${board}\n${status}`, components: rows };
}

// ---- rock, paper, scissors ------------------------------------------------------------------------------

export function rpsButtons(id: string, disabled = false) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const [i, choice] of RPS_CHOICES.entries()) row.addComponents(new ButtonBuilder().setCustomId(controlId("r", id, i)).setLabel(`${RPS_EMOJI[choice]} ${choice[0]!.toUpperCase()}${choice.slice(1)}`).setStyle(ButtonStyle.Secondary).setDisabled(disabled));
  return [row];
}

export function rpsWaitingText(players: [Player, Player], picked: [boolean, boolean]): string {
  const mark = (i: 0 | 1) => (picked[i] ? "✅ ready" : "⏳ choosing");
  return `✊ **${name(players[0])}** vs **${name(players[1])}**\nChoose in secret with the buttons.\n${name(players[0])}: ${mark(0)} · ${name(players[1])}: ${mark(1)}`;
}

export function rpsResultText(players: [Player, Player], picks: [RpsChoice, RpsChoice], outcome: "a" | "b" | "draw"): string {
  const line = `${RPS_EMOJI[picks[0]]} **${name(players[0])}** vs **${name(players[1])}** ${RPS_EMOJI[picks[1]]}`;
  return `${line}\n${outcome === "draw" ? "It's a draw!" : `🏆 **${name(players[outcome === "a" ? 0 : 1])}** wins!`}`;
}

// ---- trivia ---------------------------------------------------------------------------------------------

const LETTERS = ["A", "B", "C", "D"] as const;

export function triviaQuestion(round: TriviaRound, seconds: number): EmbedBuilder {
  const options = round.options.map((o, i) => `**${LETTERS[i]}** · ${escapeText(truncate(o, 80))}`).join("\n");
  return new EmbedBuilder()
    .setColor(0x00ffa8)
    .setTitle(`🧠 Trivia · ${round.category}`)
    .setDescription(`**${escapeText(truncate(round.question, 250))}**\n\n${options}`)
    .setFooter({ text: `Answer with the buttons. You have ${seconds} seconds, one try each.` });
}

export function triviaButtons(id: string, round: TriviaRound, reveal: boolean) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 0; i < 4; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(controlId("q", id, i))
        .setLabel(LETTERS[i]!)
        .setStyle(reveal ? (i === round.correct ? ButtonStyle.Success : ButtonStyle.Secondary) : ButtonStyle.Primary)
        .setDisabled(reveal),
    );
  }
  return [row];
}

export function triviaResult(round: TriviaRound, winners: Player[], answered: number): EmbedBuilder {
  const right = escapeText(truncate(round.options[round.correct]!, 80));
  const shown = winners.slice(0, 15).map((p) => escapeText(truncate(p.name, 32)) || "player");
  const extra = winners.length > shown.length ? ` and ${winners.length - shown.length} more` : "";
  const who = winners.length === 0 ? "Nobody got it right this time." : `✅ Got it right: ${shown.join(", ")}${extra}`;
  return new EmbedBuilder()
    .setColor(winners.length > 0 ? 0x2ecc71 : 0xe74c3c)
    .setTitle(`🧠 Trivia · ${round.category}`)
    .setDescription(`**${escapeText(truncate(round.question, 250))}**\n\nThe answer: **${LETTERS[round.correct]} · ${right}**\n${who}`)
    .setFooter({ text: `${answered} ${answered === 1 ? "player" : "players"} answered` });
}
