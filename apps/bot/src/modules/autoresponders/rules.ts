import type { MatchType } from "@aboutselphy/shared/auto-responders";
import { withEmotes } from "../../lib/emotes";
import { escapeText, truncate } from "../../lib/escape";

// When an auto-responder fires and what it says. Pure, so the rules are testable. The trigger is
// only ever used as literal text (escaped before it goes near a regular expression), so a trigger
// can't make the matching slow or odd.

/** Lower case, NFKC, invisible characters removed, spaces collapsed: what both sides are compared as. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function matches(type: MatchType, trigger: string, content: string): boolean {
  const t = normalizeForMatch(trigger);
  const c = normalizeForMatch(content);
  if (!t || !c) return false;
  if (type === "exact") return c === t;
  if (type === "contains") return c.includes(t);
  // "word": the trigger must not sit inside a longer word ("cat" matches "my cat!" but not "category").
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(t)}(?![\\p{L}\\p{N}_])`, "u").test(c);
}

/** Is the responder allowed in this channel? Empty list = everywhere. */
export const allowedIn = (channelIds: readonly string[], channelId: string): boolean => channelIds.length === 0 || channelIds.includes(channelId);

/** Fills {user} (shown as a mention, which can't notify: replies allow no mentions) and {username} (escaped). */
export function renderResponse(template: string, who: { id: string; username: string }): string {
  return truncate(withEmotes(template.replace(/\{user\}/g, `<@${who.id}>`).replace(/\{username\}/g, escapeText(truncate(who.username, 60)))), 2000);
}

/** Remembers when something last happened per key, to enforce cooldowns. */
export class Cooldowns {
  private last = new Map<string, number>();
  /** True (and starts the cooldown) if `key` is free at `now`. */
  take(key: string, seconds: number, now = Date.now()): boolean {
    const at = this.last.get(key);
    if (at !== undefined && now - at < seconds * 1000) return false;
    this.last.set(key, now);
    if (this.last.size > 2000) for (const [k, v] of this.last) if (now - v > 86_400_000) this.last.delete(k);
    return true;
  }
}
