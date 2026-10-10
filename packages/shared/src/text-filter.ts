/** Cyrillic and Greek letters that look like Latin ones, the classic way around a word filter. */
const CONFUSABLES: Record<string, string> = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x",
  і: "i", ј: "j", ѕ: "s", ӏ: "i", ё: "e",
  α: "a", β: "b", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
};

/**
 * Text prepared for matching: NFKC (so fullwidth letters become normal ones),
 * lowercase, ß written out, look-alike Cyrillic/Greek letters mapped to Latin,
 * accents and umlauts stripped, invisible characters removed, whitespace
 * collapsed. Both the filters below run on this form.
 */
export function normalizeForMatch(text: string): string {
  const lowered = text.normalize("NFKC").toLowerCase().replaceAll("ß", "ss");
  const mapped = [...lowered].map((ch) => CONFUSABLES[ch] ?? ch).join("");
  return mapped
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim();
}

/**
 * The first of the admin's own blocked words that the text contains (a plain,
 * case-insensitive substring after normalising), or null. These are literal
 * words, not patterns: nothing an admin types here can be a slow regex.
 */
export function findBlockedWord(text: string, blockedWords: readonly string[]): string | null {
  const haystack = normalizeForMatch(text);
  for (const word of blockedWords) {
    const needle = normalizeForMatch(word);
    if (needle && haystack.includes(needle)) return word;
  }
  return null;
}
