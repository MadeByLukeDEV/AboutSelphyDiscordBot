import { mapEmotes } from "./emotes";

/**
 * Makes user-controlled text inert in a Discord message or embed: markdown is
 * escaped, "<" is escaped so <@id>, <#id>, <@&id> and <t:..> can't be forged,
 * and "://" is escaped so bare URLs don't become links. Same rules as
 * ../Main/src/modules/schedule/discord/message.ts. Whitespace is collapsed.
 */
export function escapeText(text: string): string {
  // The server's own emotes (<:name:id> or :name:) are kept as real emotes; everything around them is escaped as before.
  return mapEmotes(text, escapePlain).replace(/\s+/g, " ").trim();
}

function escapePlain(text: string): string {
  return text.replace(/([\\*_~`|<>[\]()#])/g, "\\$1").replace(/:\/\//g, "\\://");
}

/** Cuts to `max` characters (not UTF-16 units) with an ellipsis. */
export function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("")}…`;
}
