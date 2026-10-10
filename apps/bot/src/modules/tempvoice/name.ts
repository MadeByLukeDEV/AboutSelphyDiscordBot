import { findBlockedWord, findProfanity } from "@aboutselphy/shared";

export { findBlockedWord };

const MAX_NAME_LENGTH = 100;
const FALLBACK_NAME = "Voice room";

/**
 * What a room name may not contain: the admin's own words (literal text) and,
 * unless switched off, the built-in list of common insults and slurs.
 */
export type BlockPolicy = { words: readonly string[]; useDefaultList: boolean };

/** The policy from the saved settings. */
export function policyOf(config: { blockedWords: string[] | null; useDefaultBlocklist: boolean }): BlockPolicy {
  return { words: config.blockedWords ?? [], useDefaultList: config.useDefaultBlocklist };
}

/** True when the text hits the policy. Callers say "that isn't allowed", never which word matched. */
export function isBlocked(text: string, policy: BlockPolicy): boolean {
  return findBlockedWord(text, policy.words) !== null || (policy.useDefaultList && findProfanity(text) !== null);
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
 * display name. If the result is blocked (a display name can be!) or comes out
 * empty, the neutral fallback is used instead, so a room can always be created
 * and never shows a blocked word.
 */
export function renderRoomName(template: string, displayName: string, policy: BlockPolicy): string {
  const name = sanitizeRoomName(template.replaceAll("{user}", sanitizeRoomName(displayName)));
  if (!name || isBlocked(name, policy)) return FALLBACK_NAME;
  return name;
}

/** Result of a rename request by a member. */
export type RenameCheck = { ok: true; name: string } | { ok: false; reason: "empty" | "blocked" };

export function checkRename(requested: string, policy: BlockPolicy): RenameCheck {
  const name = sanitizeRoomName(requested);
  if (!name) return { ok: false, reason: "empty" };
  if (isBlocked(name, policy)) return { ok: false, reason: "blocked" };
  return { ok: true, name };
}
