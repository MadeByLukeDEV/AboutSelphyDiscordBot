import { MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction, type Guild, type Message } from "discord.js";
import type { GameConfig } from "@aboutselphy/db";
import type { StatGame } from "@aboutselphy/shared/games";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { onReload } from "../../internal-api/reload";
import { env } from "../../lib/env";
import { escapeText, truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { staffLevel } from "../../lib/permissions";
import { awardXp } from "../levels";
import { c4Drop, c4Result, dayKey, emptyC4, emptyTtt, GAME_PREFIX, grantableXp, isRpsChoice, newGameId, parseControl, randomRps, RPS_CHOICES, rpsOutcome, triviaRound, tttPlace, tttResult, type C4Grid, type Mark, type Rng, type RpsChoice, type TriviaRound, type TttBoard } from "./logic";
import { addXpUsed, pruneXpDays, readConfig, recordResults, xpUsed, type Result } from "./repository";
import { c4Message, rpsButtons, rpsResultText, rpsWaitingText, triviaButtons, triviaQuestion, triviaResult, tttMessage, type Player } from "./render";
import { TRIVIA } from "./trivia-bank";

// The minigames' state and flow. A running game lives in memory only (a restart just ends open games: their buttons then say
// so), results go to the database. Duels are played with buttons by exactly two members; trivia is open to everyone in the
// channel. Winning gives level XP (through the leveling module, capped per day).

const NO_MENTIONS = { parse: [] as never[] };
const rng: Rng = Math.random;
const DUEL_IDLE_MS = 10 * 60_000;
const RPS_IDLE_MS = 5 * 60_000;
const TRIVIA_MS = 20_000;
const MAX_GAMES = 300;
const MAX_OPEN_PER_PLAYER = 2;

type Duel = { kind: "t"; id: string; players: [Player, Player]; board: TttBoard; turn: 0 | 1; message: Message; timer: ReturnType<typeof setTimeout> };
type Connect = { kind: "c"; id: string; players: [Player, Player]; grid: C4Grid; turn: 0 | 1; message: Message; timer: ReturnType<typeof setTimeout> };
type Rps = { kind: "r"; id: string; players: [Player, Player]; picks: [RpsChoice | null, RpsChoice | null]; message: Message; timer: ReturnType<typeof setTimeout> };
type Trivia = { kind: "q"; id: string; round: TriviaRound; answers: Map<string, { player: Player; index: number }>; message: Message; timer: ReturnType<typeof setTimeout> };
type Game = Duel | Connect | Rps | Trivia;

const games = new Map<string, Game>();
const startedAt = new Map<string, number>();
const recentTrivia: number[] = [];
let pruneTimer: ReturnType<typeof setInterval> | undefined;

// ---- config ---------------------------------------------------------------------------------------------

let cached: { value: GameConfig; at: number } | undefined;
async function config(): Promise<GameConfig> {
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  cached = { value: await readConfig(), at: Date.now() };
  return cached.value;
}
export const readGameConfig = (): Promise<GameConfig> => config();
onReload("games", () => {
  cached = undefined;
});

// ---- helpers --------------------------------------------------------------------------------------------

export const playerOf = (u: { id: string; displayName: string }): Player => ({ id: u.id, name: u.displayName });

const openGamesOf = (userId: string): number => [...games.values()].filter((g) => g.kind !== "q" && g.players.some((p) => p.id === userId)).length;

/** Every start goes through here: the game must be switched on, the channel allowed, the member not spamming. Replies and returns null when not. */
export async function gate(i: ChatInputCommandInteraction, flag: "triviaOn" | "rpsOn" | "tictactoeOn" | "connect4On" | "wordOn"): Promise<GameConfig | null> {
  const c = await config();
  const refuse = (text: string) => i.reply({ content: text, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS }).then(() => null);
  if (!c[flag]) return refuse("That game is switched off right now.");
  const channel = i.channel;
  const allowed = c.allowedChannelIds;
  const staff = i.inCachedGuild() && staffLevel(i.member) !== null;
  if (allowed.length > 0 && !staff) {
    const ids = [i.channelId, channel && "parentId" in channel ? channel.parentId : null].filter((x): x is string => Boolean(x));
    if (!ids.some((id) => allowed.includes(id))) return refuse("Games can't be started in this channel. Try one of the game channels.");
  }
  const last = startedAt.get(i.user.id) ?? 0;
  const wait = c.cooldownSeconds * 1000 - (Date.now() - last);
  if (wait > 0 && !staff) return refuse(`Slow down a little: you can start another game in ${Math.ceil(wait / 1000)} seconds.`);
  if (games.size >= MAX_GAMES) return refuse("Too many games are running right now. Try again in a minute.");
  startedAt.set(i.user.id, Date.now());
  if (startedAt.size > 500) for (const [id, t] of startedAt) if (Date.now() - t > 600_000) startedAt.delete(id);
  return c;
}

export async function giveXp(guild: Guild, player: Player, c: GameConfig): Promise<number> {
  if (c.winXp <= 0) return 0;
  const day = dayKey(new Date());
  const grant = grantableXp(c.winXp, await xpUsed(player.id, day), c.dailyXpCap);
  if (grant <= 0) return 0;
  const member = await guild.members.fetch(player.id).catch(() => null);
  if (!member) return 0;
  const given = await awardXp(member, grant);
  if (given > 0) await addXpUsed(player.id, day, given);
  return given;
}

export async function record(game: StatGame, results: Array<{ player: Player; result: Result }>): Promise<void> {
  await recordResults(game, results.map((r) => ({ userId: r.player.id, name: r.player.name, result: r.result })));
}

function drop(game: Game): void {
  clearTimeout(game.timer);
  games.delete(game.id);
}

// ---- duels ------------------------------------------------------------------------------------------------

export async function startDuel(i: ChatInputCommandInteraction, kind: "t" | "c"): Promise<void> {
  if (!i.inCachedGuild()) return;
  const c = await gate(i, kind === "t" ? "tictactoeOn" : "connect4On");
  if (!c) return;
  const opponent = i.options.getUser("opponent", true);
  const member = i.options.getMember("opponent");
  if (opponent.bot) return void (await i.reply({ content: "Bots don't play board games. Pick a member.", flags: MessageFlags.Ephemeral }));
  if (opponent.id === i.user.id) return void (await i.reply({ content: "You can't play against yourself. Pick another member.", flags: MessageFlags.Ephemeral }));
  if (!member) return void (await i.reply({ content: "That member isn't in the server.", flags: MessageFlags.Ephemeral }));
  if (openGamesOf(i.user.id) >= MAX_OPEN_PER_PLAYER || openGamesOf(opponent.id) >= MAX_OPEN_PER_PLAYER) return void (await i.reply({ content: "One of you already has games running. Finish those first.", flags: MessageFlags.Ephemeral }));

  const id = newGameId(rng);
  const players: [Player, Player] = [playerOf(i.member), playerOf(member)];
  const body = kind === "t" ? tttMessage({ players, board: emptyTtt(), turn: 0, id }, null) : c4Message({ players, grid: emptyC4(), turn: 0, id }, null);
  const sent = await i.reply({ ...body, allowedMentions: { parse: [], users: [opponent.id] }, withResponse: true });
  const message = sent.resource?.message;
  if (!message) return;
  const base = { id, players, message, timer: setTimeout(() => void expire(id), DUEL_IDLE_MS) };
  games.set(id, kind === "t" ? { kind: "t", board: emptyTtt(), turn: 0, ...base } : { kind: "c", grid: emptyC4(), turn: 0, ...base });
  log.info({ game: kind, a: i.user.id, b: opponent.id }, "games: duel started");
}

async function expire(id: string): Promise<void> {
  const game = games.get(id);
  if (!game) return;
  drop(game);
  if (game.kind === "q") return; // trivia has its own ending
  const text = game.kind === "r" ? rpsWaitingText(game.players, [game.picks[0] !== null, game.picks[1] !== null]) : game.kind === "t" ? tttMessage(game, null).content : c4Message(game, null).content;
  await game.message.edit({ content: truncate(`${text}\n⌛ Timed out.`, 1900), components: [], allowedMentions: NO_MENTIONS }).catch(() => undefined);
}

async function onDuelButton(i: ButtonInteraction, game: Duel | Connect, arg: number): Promise<void> {
  const who = game.players.findIndex((p) => p.id === i.user.id);
  if (who < 0) return void (await i.reply({ content: "This isn't your game. Start one with `/game`.", flags: MessageFlags.Ephemeral }));
  if (who !== game.turn) return void (await i.reply({ content: "It's not your turn.", flags: MessageFlags.Ephemeral }));
  const mark: Mark = game.turn === 0 ? "X" : "O";

  let result: Mark | "draw" | null;
  if (game.kind === "t") {
    const next = tttPlace(game.board, arg, mark);
    if (!next) return void (await i.reply({ content: "That cell is taken.", flags: MessageFlags.Ephemeral }));
    game.board = next;
    result = tttResult(next);
  } else {
    const dropped = c4Drop(game.grid, arg, mark);
    if (!dropped) return void (await i.reply({ content: "That column is full.", flags: MessageFlags.Ephemeral }));
    game.grid = dropped.grid;
    result = c4Result(dropped.grid);
  }
  if (result === null) game.turn = game.turn === 0 ? 1 : 0;

  const body = game.kind === "t" ? tttMessage(game, result) : c4Message(game, result);
  if (result === null) {
    clearTimeout(game.timer);
    game.timer = setTimeout(() => void expire(game.id), DUEL_IDLE_MS);
    return void (await i.update({ ...body, allowedMentions: NO_MENTIONS }));
  }

  drop(game);
  const statGame: StatGame = game.kind === "t" ? "tictactoe" : "connect4";
  const winnerIndex = result === "draw" ? null : result === "X" ? 0 : 1;
  const results = game.players.map((player, idx) => ({ player, result: (winnerIndex === null ? "draw" : idx === winnerIndex ? "win" : "loss") as Result }));
  let extra = "";
  try {
    await record(statGame, results);
    if (winnerIndex !== null && i.inCachedGuild()) {
      const given = await giveXp(i.guild, game.players[winnerIndex]!, await config());
      if (given > 0) extra = `\n✨ +${given} XP for ${escapeText(truncate(game.players[winnerIndex]!.name, 32))}`;
    }
  } catch (err) {
    log.error({ err }, "games: recording a duel failed");
  }
  await i.update({ ...body, content: `${body.content}${extra}`, allowedMentions: NO_MENTIONS });
}

// ---- rock, paper, scissors ------------------------------------------------------------------------------

export async function startRps(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.inCachedGuild()) return;
  const c = await gate(i, "rpsOn");
  if (!c) return;
  const opponent = i.options.getUser("opponent");
  const me = playerOf(i.member);

  if (!opponent) {
    // Against the bot: pick on the spot and answer at once.
    await i.reply({ content: `✊ **${escapeText(truncate(me.name, 32))}** vs the bot\nChoose with the buttons.`, components: rpsButtons("solo000000"), allowedMentions: NO_MENTIONS });
    // The solo game is stateless: the buttons carry everything (see onRpsButton).
    return;
  }
  const member = i.options.getMember("opponent");
  if (opponent.bot || opponent.id === i.user.id || !member) return void (await i.reply({ content: "Pick another member to play against, or leave the opponent empty to play the bot.", flags: MessageFlags.Ephemeral }));
  if (openGamesOf(i.user.id) >= MAX_OPEN_PER_PLAYER || openGamesOf(opponent.id) >= MAX_OPEN_PER_PLAYER) return void (await i.reply({ content: "One of you already has games running. Finish those first.", flags: MessageFlags.Ephemeral }));

  const id = newGameId(rng);
  const players: [Player, Player] = [me, playerOf(member)];
  const sent = await i.reply({ content: rpsWaitingText(players, [false, false]), components: rpsButtons(id), allowedMentions: { parse: [], users: [opponent.id] }, withResponse: true });
  const message = sent.resource?.message;
  if (!message) return;
  games.set(id, { kind: "r", id, players, picks: [null, null], message, timer: setTimeout(() => void expire(id), RPS_IDLE_MS) });
}

async function onRpsButton(i: ButtonInteraction, id: string, arg: string): Promise<void> {
  const choice = RPS_CHOICES[Number(arg)];
  if (!choice || !isRpsChoice(choice)) return void (await i.reply({ content: "That button isn't valid any more.", flags: MessageFlags.Ephemeral }));

  if (id === "solo000000") {
    // Solo: only the member who started it may play, and the buttons then disappear.
    const starter = i.message.interactionMetadata?.user.id;
    if (starter !== i.user.id) return void (await i.reply({ content: "This game belongs to someone else. Start your own with `/game rps`.", flags: MessageFlags.Ephemeral }));
    const botPick = randomRps(rng);
    const outcome = rpsOutcome(choice, botPick);
    const me: Player = { id: i.user.id, name: i.user.displayName };
    const text = rpsResultText([me, { id: "bot", name: "the bot" }], [choice, botPick], outcome);
    await i.update({ content: text, components: [], allowedMentions: NO_MENTIONS });
    await record("rps", [{ player: me, result: outcome === "a" ? "win" : outcome === "draw" ? "draw" : "loss" }]).catch((err) => log.error({ err }, "games: recording rps failed"));
    // Wins against the bot give no XP: only duels between members do.
    return;
  }

  const game = games.get(id);
  if (!game || game.kind !== "r") return void (await i.reply({ content: "This game is over.", flags: MessageFlags.Ephemeral }));
  const who = game.players.findIndex((p) => p.id === i.user.id);
  if (who < 0) return void (await i.reply({ content: "This isn't your game.", flags: MessageFlags.Ephemeral }));
  if (game.picks[who as 0 | 1]) return void (await i.reply({ content: "You already chose.", flags: MessageFlags.Ephemeral }));
  game.picks[who as 0 | 1] = choice;

  if (!game.picks[0] || !game.picks[1]) {
    await i.reply({ content: `You chose ${choice}. Waiting for the other player…`, flags: MessageFlags.Ephemeral });
    await game.message.edit({ content: rpsWaitingText(game.players, [game.picks[0] !== null, game.picks[1] !== null]), allowedMentions: NO_MENTIONS }).catch(() => undefined);
    return;
  }
  drop(game);
  const picks = game.picks as [RpsChoice, RpsChoice];
  const outcome = rpsOutcome(picks[0], picks[1]);
  let extra = "";
  try {
    await record("rps", game.players.map((player, idx) => ({ player, result: (outcome === "draw" ? "draw" : (outcome === "a") === (idx === 0) ? "win" : "loss") as Result })));
    if (outcome !== "draw" && i.inCachedGuild()) {
      const winner = game.players[outcome === "a" ? 0 : 1];
      const given = await giveXp(i.guild, winner, await config());
      if (given > 0) extra = `\n✨ +${given} XP for ${escapeText(truncate(winner.name, 32))}`;
    }
  } catch (err) {
    log.error({ err }, "games: recording rps failed");
  }
  await i.update({ content: `${rpsResultText(game.players, picks, outcome)}${extra}`, components: [], allowedMentions: NO_MENTIONS });
}

// ---- trivia ---------------------------------------------------------------------------------------------

export async function startTrivia(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.inCachedGuild()) return;
  const c = await gate(i, "triviaOn");
  if (!c) return;
  if ([...games.values()].some((g) => g.kind === "q" && g.message.channelId === i.channelId)) return void (await i.reply({ content: "A trivia question is already running in this channel.", flags: MessageFlags.Ephemeral }));

  const { index, round } = triviaRound(TRIVIA, new Set(recentTrivia), rng);
  recentTrivia.push(index);
  if (recentTrivia.length > 40) recentTrivia.shift();
  const id = newGameId(rng);
  const sent = await i.reply({ embeds: [triviaQuestion(round, TRIVIA_MS / 1000)], components: triviaButtons(id, round, false), allowedMentions: NO_MENTIONS, withResponse: true });
  const message = sent.resource?.message;
  if (!message) return;
  games.set(id, { kind: "q", id, round, answers: new Map(), message, timer: setTimeout(() => void finishTrivia(id, i.guild), TRIVIA_MS) });
}

async function onTriviaButton(i: ButtonInteraction, id: string, arg: string): Promise<void> {
  const game = games.get(id);
  if (!game || game.kind !== "q") return void (await i.reply({ content: "This question is over.", flags: MessageFlags.Ephemeral }));
  const index = Number(arg);
  if (!Number.isInteger(index) || index < 0 || index > 3) return;
  if (game.answers.has(i.user.id)) return void (await i.reply({ content: "You already answered this one.", flags: MessageFlags.Ephemeral }));
  game.answers.set(i.user.id, { player: { id: i.user.id, name: i.user.displayName }, index });
  await i.reply({ content: "Locked in! The answer is revealed when the time is up.", flags: MessageFlags.Ephemeral });
}

async function finishTrivia(id: string, guild: Guild): Promise<void> {
  const game = games.get(id);
  if (!game || game.kind !== "q") return;
  drop(game);
  const answers = [...game.answers.values()];
  const winners = answers.filter((a) => a.index === game.round.correct).map((a) => a.player);
  await game.message.edit({ embeds: [triviaResult(game.round, winners, answers.length)], components: triviaButtons(id, game.round, true), allowedMentions: NO_MENTIONS }).catch(() => undefined);
  try {
    const winnerIds = new Set(winners.map((w) => w.id));
    await record("trivia", answers.map((a) => ({ player: a.player, result: (winnerIds.has(a.player.id) ? "win" : "loss") as Result })));
    const c = await config();
    for (const w of winners) await giveXp(guild, w, c);
  } catch (err) {
    log.error({ err }, "games: finishing trivia failed");
  }
}

// ---- buttons and start-up -------------------------------------------------------------------------------

async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID || !i.isButton()) return;
  const parsed = parseControl(i.customId);
  if (!parsed) return void (await i.reply({ content: "That button isn't valid any more.", flags: MessageFlags.Ephemeral }));
  if (i.user.bot) return;
  if (parsed.kind === "r") return onRpsButton(i, parsed.id, parsed.arg);
  if (parsed.kind === "q") return onTriviaButton(i, parsed.id, parsed.arg);
  const game = games.get(parsed.id);
  if (!game || (game.kind !== "t" && game.kind !== "c") || game.kind !== parsed.kind) return void (await i.reply({ content: "This game is over.", flags: MessageFlags.Ephemeral }));
  const arg = Number(parsed.arg);
  if (!Number.isInteger(arg)) return;
  await onDuelButton(i, game, arg);
}

export function registerGameControls(): void {
  onComponent(GAME_PREFIX, handle);
}

export function startGames(): void {
  pruneTimer = setInterval(() => void pruneXpDays(dayKey(new Date(Date.now() - 7 * 86_400_000))).catch((err) => log.warn({ err }, "games: pruning failed")), 6 * 3_600_000);
  pruneTimer.unref();
}

export function stopGames(): void {
  if (pruneTimer) clearInterval(pruneTimer);
  pruneTimer = undefined;
  for (const g of games.values()) clearTimeout(g.timer);
  games.clear();
}
