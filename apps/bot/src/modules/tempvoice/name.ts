const MAX_NAME_LENGTH = 100;
const FALLBACK_NAME = "Voice room";

/** Lowercased, NFKC-normalised, with invisible characters removed, for matching. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\p{Cf}\p{Cc}]/gu, "")
    .toLowerCase();
}

/** The first blocked word the text contains (case-insensitive, ignoring zero-width tricks), or null. */
export function findBlockedWord(text: string, blockedWords: readonly string[]): string | null {
  const haystack = normalizeForMatch(text);
  for (const word of blockedWords) {
    const needle = normalizeForMatch(word).trim();
    if (needle && haystack.includes(needle)) return word;
  }
  return null;
}

/**
 * A channel name from free text: control and zero-width characters removed,
 * whitespace collapsed, cut to Discord's 100 characters (counted as characters,
 * so an emoji is never split in half). Empty input gives an empty string.
 */
export function sanitizeRoomName(input: string): string {
  const cleaned = input
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return [...cleaned].slice(0, MAX_NAME_LENGTH).join("").trim();
}

/**
 * The name of a new room: the template with {user} replaced by the owner's
 * display name. If the result contains a blocked word (a display name can!),
 * or comes out empty, the neutral fallback is used instead, so a room can always
 * be created and never shows a blocked word.
 */
export function renderRoomName(template: string, displayName: string, blockedWords: readonly string[]): string {
  const name = sanitizeRoomName(template.replaceAll("{user}", sanitizeRoomName(displayName)));
  if (!name || findBlockedWord(name, blockedWords)) return FALLBACK_NAME;
  return name;
}

/** Result of a rename request by a member. */
export type RenameCheck = { ok: true; name: string } | { ok: false; reason: "empty" | "blocked" };

export function checkRename(requested: string, blockedWords: readonly string[]): RenameCheck {
  const name = sanitizeRoomName(requested);
  if (!name) return { ok: false, reason: "empty" };
  if (findBlockedWord(name, blockedWords)) return { ok: false, reason: "blocked" };
  return { ok: true, name };
}
