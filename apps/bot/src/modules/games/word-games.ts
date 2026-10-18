import { Events, MessageFlags, type ChatInputCommandInteraction, type Client, type Message } from "discord.js";
import type { StatGame } from "@aboutselphy/shared/games";
import { env, integrationsActive } from "../../lib/env";
import { escapeText, truncate } from "../../lib/escape";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import type { Rng } from "./logic";
import type { Player } from "./render";
import { gate, giveXp, playerOf, record, readGameConfig } from "./service";
import { compareGuess, gallows, GUESS_MAX, guessLetter, guessWord, isScrambleAnswer, newHangman, parseHangmanGuess, parseNumberGuess, pickWord, scramble, maskedWord, type Hangman } from "./words";

// The chat games: hangman, word scramble and guess-the-number. They run in the channel where they were started (one at a
// time per channel) and everyone plays by typing, so they need the Message Content intent like the counting channel. Running
// games live in memory only. The first member to solve (or guess) wins; winners get game XP like duel winners, others who
// took part only get a "played".

const NO_MENTIONS = { parse: [] as never[] };
const rng: Rng = Math.random;
const HANGMAN_IDLE_MS = 5 * 60_000;
const SCRAMBLE_MS = 45_000;
const GUESS_MS = 3 * 60_000;

type Base = { channelId: string; message: Message; timer: ReturnType<typeof setTimeout> };
type HangmanGame = Base & { kind: "hangman"; h: Hangman; players: Map<string, Player> };
type ScrambleGame = Base & { kind: "scramble"; word: string };
type GuessGame = Base & { kind: "guess"; secret: number; players: Map<string, Player> };
type WordGame = HangmanGame | ScrambleGame | GuessGame;

const active = new Map<string, WordGame>();
const mutex = new KeyedMutex();
const recentWords: string[] = [];
let available = false;

const safeName = (p: Player) => escapeText(truncate(p.name, 32)) || "player";

// ---- start ----------------------------------------------------------------------------------------------

async function begin(i: ChatInputCommandInteraction): Promise<boolean> {
  if (!i.inCachedGuild()) return false;
  if (!available) {
    await i.reply({ content: "Chat games aren't available right now.", flags: MessageFlags.Ephemeral });
    return false;
  }
  if (active.has(i.channelId)) {
    await i.reply({ content: "A word game is already running in this channel. Finish it first.", flags: MessageFlags.Ephemeral });
    return false;
  }
  return (await gate(i, "wordOn")) !== null;
}

function remember(word: string): void {
  recentWords.push(word);
  if (recentWords.length > 30) recentWords.shift();
}

const hangmanText = (g: HangmanGame, footer: string): string => {
  const wrong = [...g.h.wrong].map((l) => l.toUpperCase()).join(" ") || "-";
  return `🪢 **Hangman** ${gallows(g.h)}\n${maskedWord(g.h)}\n❤️ ${g.h.lives} lives left · Wrong: ${wrong}\n${footer}`;
};

export async function startHangman(i: ChatInputCommandInteraction): Promise<void> {
  if (!(await begin(i))) return;
  const word = pickWord(rng, new Set(recentWords));
  remember(word);
  const h = newHangman(word);
  const draft = { kind: "hangman", h, players: new Map<string, Player>() } as HangmanGame;
  const sent = await i.reply({ content: hangmanText(draft, "Type a **letter**, or guess the **whole word**. Anyone can play!"), allowedMentions: NO_MENTIONS, withResponse: true });
  const message = sent.resource?.message;
  if (!message) return;
  const game: HangmanGame = { ...draft, channelId: i.channelId, message, timer: setTimeout(() => void timeout(i.channelId), HANGMAN_IDLE_MS) };
  active.set(i.channelId, game);
}

export async function startScramble(i: ChatInputCommandInteraction): Promise<void> {
  if (!(await begin(i))) return;
  const word = pickWord(rng, new Set(recentWords));
  remember(word);
  const sent = await i.reply({ content: `🔤 **Unscramble the word!** First to type it wins.\n\`${[...scramble(word, rng)].join(" ").toUpperCase()}\`\n*You have ${SCRAMBLE_MS / 1000} seconds.*`, allowedMentions: NO_MENTIONS, withResponse: true });
  const message = sent.resource?.message;
  if (!message) return;
  active.set(i.channelId, { kind: "scramble", word, channelId: i.channelId, message, timer: setTimeout(() => void timeout(i.channelId), SCRAMBLE_MS) });
}

export async function startGuess(i: ChatInputCommandInteraction): Promise<void> {
  if (!(await begin(i))) return;
  const secret = Math.floor(rng() * GUESS_MAX) + 1;
  const sent = await i.reply({ content: `🔢 **Guess the number!** I'm thinking of a number from 1 to ${GUESS_MAX}.\nType your guess. I react 🔼 if my number is higher and 🔽 if it is lower. First to get it wins.\n*You have ${GUESS_MS / 60_000} minutes.*`, allowedMentions: NO_MENTIONS, withResponse: true });
  const message = sent.resource?.message;
  if (!message) return;
  active.set(i.channelId, { kind: "guess", secret, players: new Map(), channelId: i.channelId, message, timer: setTimeout(() => void timeout(i.channelId), GUESS_MS) });
}

// ---- ending ---------------------------------------------------------------------------------------------

function end(game: WordGame): void {
  clearTimeout(game.timer);
  active.delete(game.channelId);
}

async function timeout(channelId: string): Promise<void> {
  await mutex.run(channelId, async () => {
    const game = active.get(channelId);
    if (!game) return;
    end(game);
    const answer = game.kind === "hangman" ? game.h.word : game.kind === "scramble" ? game.word : String(game.secret);
    const label = game.kind === "guess" ? "The number was" : "The word was";
    await game.message.edit({ content: `⌛ **Time's up!** ${label} **${escapeText(answer)}**.`, allowedMentions: NO_MENTIONS }).catch(() => undefined);
    if (game.kind !== "scramble") await recordParticipants(game, null).catch((err) => log.error({ err }, "games: recording a word game failed"));
  });
}

/** Winner (if any) gets a win and game XP, everyone else who took part a played game. */
async function recordParticipants(game: HangmanGame | GuessGame, winner: Player | null): Promise<void> {
  const stat: StatGame = game.kind === "hangman" ? "hangman" : "guess";
  const rows = [...game.players.values()].map((player) => ({ player, result: (winner && player.id === winner.id ? "win" : "loss") as "win" | "loss" }));
  if (rows.length > 0) await record(stat, rows);
}

async function award(message: Message, winner: Player): Promise<string> {
  if (!message.guild) return "";
  const given = await giveXp(message.guild, winner, await readGameConfig()).catch(() => 0);
  return given > 0 ? `\n✨ +${given} XP for ${safeName(winner)}` : "";
}

// ---- messages -------------------------------------------------------------------------------------------

async function handle(game: WordGame, m: Message): Promise<void> {
  const player = playerOf({ id: m.author.id, displayName: m.member?.displayName ?? m.author.displayName });

  if (game.kind === "scramble") {
    if (!isScrambleAnswer(m.content, game.word)) return;
    end(game);
    await m.react("✅").catch(() => undefined);
    await record("scramble", [{ player, result: "win" }]).catch((err) => log.error({ err }, "games: recording scramble failed"));
    const xp = await award(m, player);
    await game.message.edit({ content: `🔤 🏆 **${safeName(player)}** got it: **${escapeText(game.word)}**${xp}`, allowedMentions: NO_MENTIONS }).catch(() => undefined);
    return;
  }

  if (game.kind === "guess") {
    const n = parseNumberGuess(m.content);
    if (n === null) return;
    game.players.set(player.id, player);
    const verdict = compareGuess(game.secret, n);
    if (verdict === "higher") return void (await m.react("🔼").catch(() => undefined));
    if (verdict === "lower") return void (await m.react("🔽").catch(() => undefined));
    end(game);
    await m.react("🎉").catch(() => undefined);
    await recordParticipants(game, player).catch((err) => log.error({ err }, "games: recording guess failed"));
    const xp = await award(m, player);
    await game.message.edit({ content: `🔢 🏆 **${safeName(player)}** found it: **${game.secret}**!${xp}`, allowedMentions: NO_MENTIONS }).catch(() => undefined);
    return;
  }

  // hangman
  const guess = parseHangmanGuess(m.content, game.h.word.length);
  if (!guess) return;
  game.players.set(player.id, player);
  const result = guess.kind === "letter" ? guessLetter(game.h, guess.letter) : guessWord(game.h, guess.word);
  if (result === "repeat") return void (await m.react("🔁").catch(() => undefined));
  if (result === "hit") await m.react("✅").catch(() => undefined);
  if (result === "miss") await m.react("❌").catch(() => undefined);

  if (result === "won") {
    end(game);
    await m.react("🎉").catch(() => undefined);
    await recordParticipants(game, player).catch((err) => log.error({ err }, "games: recording hangman failed"));
    const xp = await award(m, player);
    await game.message.edit({ content: `🪢 🏆 **${safeName(player)}** solved it: **${escapeText(game.h.word)}**${xp}`, allowedMentions: NO_MENTIONS }).catch(() => undefined);
    return;
  }
  if (result === "lost") {
    end(game);
    await recordParticipants(game, null).catch((err) => log.error({ err }, "games: recording hangman failed"));
    await game.message.edit({ content: `🪢 💀 **Game over!** The word was **${escapeText(game.h.word)}**.`, allowedMentions: NO_MENTIONS }).catch(() => undefined);
    return;
  }
  clearTimeout(game.timer);
  game.timer = setTimeout(() => void timeout(game.channelId), HANGMAN_IDLE_MS);
  await game.message.edit({ content: hangmanText(game, "Type a **letter**, or guess the **whole word**."), allowedMentions: NO_MENTIONS }).catch(() => undefined);
}

export function registerWordGames(client: Client): void {
  if (!integrationsActive() || !env().DISCORD_MESSAGE_CONTENT) {
    log.info({ messageContent: env().DISCORD_MESSAGE_CONTENT, integrations: integrationsActive() }, "games: chat games not available (needs production or BOT_INTEGRATIONS_IN_DEV, and DISCORD_MESSAGE_CONTENT=true)");
    return;
  }
  available = true;
  client.on(Events.MessageCreate, (m) => {
    if (m.guildId !== env().DISCORD_GUILD_ID || m.author.bot || m.system || m.webhookId) return;
    if (!active.has(m.channelId)) return; // the common case: nothing running here, no work at all
    void mutex
      .run(m.channelId, async () => {
        const game = active.get(m.channelId);
        if (!game || !(await moduleOn("games"))) return;
        await handle(game, m);
      })
      .catch((err) => log.error({ err }, "games: a chat game message failed"));
  });
}

export function stopWordGames(): void {
  for (const g of active.values()) clearTimeout(g.timer);
  active.clear();
}
