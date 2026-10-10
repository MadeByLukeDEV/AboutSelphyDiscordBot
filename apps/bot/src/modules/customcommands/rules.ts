import { escapeText, truncate } from "../../lib/escape";

// What a custom command says. The text is written by staff, so markdown is kept, but the answer is
// sent with `allowedMentions` limited to the member who asked: nothing in it can ping anyone else.
// Pure, so the rules are testable.

/** Fills {user} (a mention of the asker), {username} and {server} (both escaped); the rest stays as staff wrote it. */
export function renderCommandText(template: string, who: { id: string; username: string; server: string }): string {
  const text = template.replace(/\{user\}/g, `<@${who.id}>`).replace(/\{username\}/g, escapeText(truncate(who.username, 60))).replace(/\{server\}/g, escapeText(truncate(who.server, 60)));
  return truncate(text, 2000);
}

/** Up to 25 names that start with what is typed (then those that contain it), for the autocomplete list. */
export function suggestNames(names: readonly string[], typed: string): Array<{ name: string; value: string }> {
  const q = typed.trim().toLowerCase();
  const starts = names.filter((n) => n.startsWith(q));
  const contains = names.filter((n) => !n.startsWith(q) && n.includes(q));
  return [...starts, ...contains].slice(0, 25).map((n) => ({ name: n, value: n }));
}
