import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";

// Pure helpers for the info commands and /help, so the formatting rules are testable. Every name
// that came from a member or the server is escaped; timestamps use Discord's own <t:..> syntax.

export const stamp = (date: Date | number | null | undefined, style: "f" | "R" | "D" = "f"): string => {
  if (date === null || date === undefined) return "unknown";
  const ms = typeof date === "number" ? date : date.getTime();
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
};

/** "<t:..:D> (<t:..:R>)" for a date. */
export const dateAndAgo = (date: Date | number | null | undefined): string => (date === null || date === undefined ? "unknown" : `${stamp(date, "D")} (${stamp(date, "R")})`);

/** A short list of mentions that fits an embed field: the first `max`, then "+N more". */
export function listMentions(ids: readonly string[], prefix: "@&" | "#" | "@", max = 15): string {
  if (ids.length === 0) return "none";
  const shown = ids.slice(0, max).map((id) => `<${prefix}${id}>`);
  return shown.join(" ") + (ids.length > max ? ` +${ids.length - max} more` : "");
}

export const yesNo = (v: boolean): string => (v ? "yes" : "no");

export type CommandEntry = { name: string; description: string; subcommands: string[]; requires: "admin" | "moderator" | null };

/** What /help shows about a registered command. Sub-command names (type 1) and groups (type 2) are listed. */
export function toEntry(data: RESTPostAPIChatInputApplicationCommandsJSONBody, requires: "admin" | "moderator" | undefined): CommandEntry {
  const subs = (data.options ?? []).filter((o) => o.type === 1 || o.type === 2).map((o) => o.name);
  return { name: data.name, description: data.description, subcommands: subs, requires: requires ?? null };
}

/** The entries a member may use: staff-only commands are hidden from everyone else (a moderator doesn't see admin commands). */
export function visibleTo(entries: readonly CommandEntry[], level: "admin" | "moderator" | null): CommandEntry[] {
  return entries.filter((e) => e.requires === null || level === "admin" || (level === "moderator" && e.requires === "moderator"));
}

/** One line per command; the text fits an embed field (1024) once cut. */
export function helpLines(entries: readonly CommandEntry[]): string[] {
  return [...entries]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => `**/${e.name}** · ${truncate(escapeText(e.description), 90)}${e.subcommands.length ? ` (${truncate(e.subcommands.join(", "), 60)})` : ""}`);
}

/** Splits lines into chunks of at most `limit` characters, for embed fields. */
export function chunkLines(lines: readonly string[], limit = 1000): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current && current.length + line.length + 1 > limit) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + line;
  }
  if (current) chunks.push(current);
  return chunks;
}
