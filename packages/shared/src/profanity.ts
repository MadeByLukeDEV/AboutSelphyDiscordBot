import { normalizeForMatch } from "./text-filter";

/**
 * A built-in list of common insults and slurs, English and German, matched in a
 * way that survives the usual tricks and doesn't punish innocent words.
 *
 * How it avoids false positives (the "Scunthorpe problem"): every pattern only
 * matches a WHOLE word, i.e. it must not be glued to a letter on either side.
 * So "assassin", "class", "cockpit", "shiitake" and "Niger" are never touched,
 * while "shit", "shits", "sh1t", "f*ck", "fuuuck" and "shit123" are.
 *
 * How it sees through tricks: each letter of a word is expanded into a class of
 * its look-alikes (a -> a 4 @, s -> s 5 $ ...), repeated letters are allowed
 * (fuuuck), `*` stands in for a vowel (f*ck), and a run of single characters
 * split by spaces or dots ("f u c k", "f.u.c.k") is joined and checked too.
 * Text is normalised first (see normalizeForMatch).
 *
 * The patterns are built here from plain words, never taken from user input, and
 * a letter run is a single quantified class, so matching stays linear: there is
 * no nested quantifier to blow up on a hostile string.
 */

type Entry = { word: string; suffixes?: string[] };

/** Plain English insults and slurs. Mild words (damn, hell, crap) are left out on purpose. */
const ENGLISH: Entry[] = [
  { word: "fuck", suffixes: ["er", "ers", "ing", "ed", "s", "tard", "head", "face", "wit"] },
  { word: "fuk", suffixes: ["er", "ing", "s", "ed"] },
  { word: "fck", suffixes: ["er", "ing", "s"] },
  { word: "motherfucker", suffixes: ["s"] },
  { word: "motherfucking" },
  { word: "shit", suffixes: ["s", "ty", "head", "hole", "bag", "face", "show"] },
  { word: "bullshit", suffixes: ["s", "ter"] },
  { word: "bitch", suffixes: ["es", "y", "ing", "ed"] },
  { word: "bastard", suffixes: ["s"] },
  { word: "asshole", suffixes: ["s"] },
  { word: "arsehole", suffixes: ["s"] },
  { word: "dumbass", suffixes: ["es"] },
  { word: "cunt", suffixes: ["s", "y"] },
  { word: "whore", suffixes: ["s"] },
  { word: "slut", suffixes: ["s", "ty"] },
  { word: "dickhead", suffixes: ["s"] },
  { word: "cocksucker", suffixes: ["s"] },
  { word: "wanker", suffixes: ["s"] },
  { word: "twat", suffixes: ["s"] },
  { word: "retard", suffixes: ["s", "ed"] },
  // Slurs
  { word: "nigger", suffixes: ["s"] },
  { word: "nigga", suffixes: ["s"] },
  { word: "faggot", suffixes: ["s"] },
  { word: "fag", suffixes: ["s"] },
  { word: "kike", suffixes: ["s"] },
  { word: "tranny", suffixes: ["s"] },
  // Telling someone to harm themselves
  { word: "kys" },
  { word: "kill yourself" },
];

/** German insults and slurs, written without umlauts or ß (the text is normalised that way). */
const GERMAN: Entry[] = [
  { word: "scheiss", suffixes: ["e", "en", "er", "kerl", "ding", "haufen", "egal"] },
  { word: "arschloch", suffixes: ["er", "s"] },
  { word: "arsch", suffixes: ["es", "gesicht", "geige"] },
  { word: "wichser", suffixes: ["s"] },
  { word: "hurensohn", suffixes: ["e", "es", "s"] },
  { word: "huso", suffixes: ["s"] },
  { word: "hure", suffixes: ["n"] },
  { word: "nutte", suffixes: ["n"] },
  { word: "fotze", suffixes: ["n"] },
  { word: "schlampe", suffixes: ["n"] },
  { word: "fick", suffixes: ["en", "er", "t", "e"] },
  { word: "missgeburt", suffixes: ["en"] },
  { word: "spast", suffixes: ["en", "i", "is"] },
  { word: "schwuchtel", suffixes: ["n"] },
  { word: "neger", suffixes: ["n", "in"] },
  { word: "kanake", suffixes: ["n"] },
  { word: "judensau" },
  { word: "heil hitler" },
  { word: "sieg heil" },
];

/** What a letter may be written as. `*` is the usual bleep for a vowel (f*ck). */
const LOOKALIKES: Record<string, string> = {
  a: "a4@*",
  e: "e3*",
  i: "i1!|*",
  o: "o0*",
  u: "uv*",
  s: "s5$",
  t: "t7+",
};

/** A word as a pattern: look-alike classes, doubled letters kept as "at least that many". */
function fuzzy(word: string): string {
  let out = "";
  for (const run of word.match(/(.)\1*/gu) ?? []) {
    const ch = run[0]!;
    if (ch === " ") {
      out += "[ ._\\-]+";
      continue;
    }
    // Every character here is a plain a-z letter, so no escaping is needed in a class.
    const piece = `[${LOOKALIKES[ch] ?? ch}]`;
    out += run.length > 1 ? `${piece}{${run.length},}` : `${piece}+`;
  }
  return out;
}

function compile({ word, suffixes }: Entry): RegExp {
  const suffix = suffixes?.length ? `(?:${suffixes.map(fuzzy).join("|")})?` : "";
  return new RegExp(`(?<![a-z])${fuzzy(word)}${suffix}(?![a-z])`, "u");
}

const PATTERNS = [...ENGLISH, ...GERMAN].map((entry) => ({ word: entry.word, regex: compile(entry) }));

/** How many patterns are built in (shown in the dashboard). */
export const BUILT_IN_PATTERN_COUNT = PATTERNS.length;

/** Single characters separated by spaces/dots/dashes ("f u c k", "f.u.c.k"), 4 or more in a row. */
const SPELLED_OUT = /(?<![a-z0-9])(?:[a-z0-9@$!|+*][ .\-_*]+){3,}[a-z0-9@$!|+*](?![a-z0-9])/gu;

function firstMatch(text: string): string | null {
  for (const { word, regex } of PATTERNS) if (regex.test(text)) return word;
  return null;
}

/** Room names are at most 100 characters; anything beyond this is not looked at. */
const MAX_CHARS = 500;
/** In one spelled-out run, only this many characters are tried in every combination. */
const MAX_SPELLED_CHARS = 40;
const MIN_SPELLED_CHARS = 4;

/**
 * The built-in entry the text matches, or null. The return value is for logs
 * and tests only: show a member "that name isn't allowed", never the word.
 */
export function findProfanity(text: string): string | null {
  const normalized = normalizeForMatch(text.slice(0, MAX_CHARS));
  const direct = firstMatch(normalized);
  if (direct) return direct;

  for (const spelled of normalized.match(SPELLED_OUT) ?? []) {
    // "you are a s.h.i.t" is one run of single characters ("a s h i t"), so a
    // lone word before the spelled one is glued on. Try every stretch of it.
    const chars = spelled.split(/[ ._\-*]+/u).filter(Boolean).slice(0, MAX_SPELLED_CHARS);
    for (let start = 0; start + MIN_SPELLED_CHARS <= chars.length; start++) {
      for (let end = start + MIN_SPELLED_CHARS; end <= chars.length; end++) {
        const found = firstMatch(chars.slice(start, end).join(""));
        if (found) return found;
      }
    }
  }
  return null;
}
