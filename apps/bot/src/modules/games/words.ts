import type { Rng } from "./logic";

// The word games' rules and word list. Pure. Words are lowercase ASCII letters only, so a guess typed in chat can be compared
// plainly.

export const WORDS = [
  "anchor", "barrel", "beacon", "bounty", "cannon", "captain", "cargo", "compass", "coral", "cutlass", "dagger", "doubloon", "galleon", "harbour",
  "island", "kraken", "lantern", "mariner", "mermaid", "musket", "ocean", "parrot", "pirate", "plank", "rudder", "saber", "sailor", "schooner",
  "shipwreck", "skeleton", "treasure", "trident", "tavern", "voyage", "whirlpool", "lagoon", "marauder", "smuggler", "telescope", "tempest",
  "adventure", "avatar", "battle", "boss", "castle", "checkpoint", "controller", "crafting", "dragon", "dungeon", "enemy", "fortress", "gamer",
  "guild", "hero", "inventory", "joystick", "keyboard", "legend", "monster", "multiplayer", "mystery", "ninja", "potion", "puzzle", "quest",
  "respawn", "roguelike", "shield", "sorcerer", "sword", "tournament", "upgrade", "warrior", "wizard", "zombie",
  "acorn", "balloon", "bicycle", "blanket", "bridge", "butter", "camera", "candle", "carpet", "chimney", "cookie", "curtain", "diamond", "dolphin",
  "elephant", "feather", "forest", "garden", "giraffe", "glacier", "guitar", "hammer", "jungle", "kitchen", "ladder", "lemon", "library", "magnet",
  "mountain", "notebook", "orange", "penguin", "pillow", "planet", "pumpkin", "rainbow", "rocket", "sandwich", "shadow", "sunrise", "thunder",
  "umbrella", "volcano", "waterfall", "window", "yogurt",
] as const;

export const pickWord = (rng: Rng, avoid: ReadonlySet<string> = new Set()): string => {
  const pool = WORDS.filter((w) => !avoid.has(w));
  const list = pool.length > 0 ? pool : WORDS;
  return list[Math.floor(rng() * list.length)]!;
};

// ---- hangman --------------------------------------------------------------------------------------------

export const HANGMAN_LIVES = 7;

export type Hangman = { word: string; correct: Set<string>; wrong: Set<string>; lives: number };

export const newHangman = (word: string): Hangman => ({ word, correct: new Set(), wrong: new Set(), lives: HANGMAN_LIVES });

/** "_ a _ _ e" style display of the word with the guessed letters filled in. */
export const maskedWord = (h: Hangman): string =>
  [...h.word].map((ch) => (h.correct.has(ch) ? ch.toUpperCase() : "\\_")).join(" ");

export const isSolved = (h: Hangman): boolean => [...h.word].every((ch) => h.correct.has(ch));

/** What a chat message means in a hangman game: a letter, a whole-word guess, or nothing. */
export function parseHangmanGuess(content: string, wordLength: number): { kind: "letter"; letter: string } | { kind: "word"; word: string } | null {
  const text = content.trim().toLowerCase();
  if (/^[a-z]$/.test(text)) return { kind: "letter", letter: text };
  if (text.length === wordLength && /^[a-z]+$/.test(text)) return { kind: "word", word: text };
  return null;
}

export type GuessResult = "hit" | "miss" | "repeat" | "won" | "lost";

/** Applies a letter. A repeated letter changes nothing; the last missing letter wins; the last life lost loses. */
export function guessLetter(h: Hangman, letter: string): GuessResult {
  if (h.correct.has(letter) || h.wrong.has(letter)) return "repeat";
  if (h.word.includes(letter)) {
    h.correct.add(letter);
    return isSolved(h) ? "won" : "hit";
  }
  h.wrong.add(letter);
  h.lives -= 1;
  return h.lives <= 0 ? "lost" : "miss";
}

/** A whole-word guess: right wins at once, wrong costs a life. */
export function guessWord(h: Hangman, word: string): GuessResult {
  if (word === h.word) {
    for (const ch of h.word) h.correct.add(ch);
    return "won";
  }
  h.lives -= 1;
  return h.lives <= 0 ? "lost" : "miss";
}

export const HANGMAN_STAGES = ["", "🪢", "🪢😵", "🪢😵👕", "🪢😵👕🦵", "🪢😵👕🦵🦵", "🪢😵👕🦵🦵🫳", "🪢😵👕🦵🦵🫳🫳"] as const;
export const gallows = (h: Hangman): string => HANGMAN_STAGES[HANGMAN_LIVES - h.lives] ?? "";

// ---- scramble -------------------------------------------------------------------------------------------

/** The letters of a word in a different order (never the word itself). */
export function scramble(word: string, rng: Rng): string {
  const letters = [...word];
  if (new Set(letters).size < 2) return word;
  for (let attempt = 0; attempt < 20; attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [letters[i], letters[j]] = [letters[j]!, letters[i]!];
    }
    if (letters.join("") !== word) return letters.join("");
  }
  // Extremely unlikely: rotate by one so it still differs.
  return word.slice(1) + word[0];
}

export const isScrambleAnswer = (content: string, word: string): boolean => content.trim().toLowerCase() === word;

// ---- guess the number -----------------------------------------------------------------------------------

export const GUESS_MAX = 100;

/** A number from 1 to 100 typed on its own, else null. */
export function parseNumberGuess(content: string): number | null {
  const text = content.trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= GUESS_MAX ? n : null;
}

export const compareGuess = (secret: number, guess: number): "higher" | "lower" | "correct" => (guess === secret ? "correct" : guess < secret ? "higher" : "lower");
