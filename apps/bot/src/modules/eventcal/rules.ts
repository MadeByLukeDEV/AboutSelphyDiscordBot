import { createHash } from "node:crypto";
import { EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";
import type { CalEvent } from "./ics";

// Which events a rule posts, when, and what the messages look like. Pure, so the rules are testable.

export type RuleFacts = { words: readonly string[]; categories: readonly string[] };

const fold = (t: string): string => t.normalize("NFKC").toLowerCase();

/** An event matches a rule when its name contains one of the rule's words, or it carries one of the rule's tags. Words are plain text, never patterns. */
export function matchesRule(event: Pick<CalEvent, "summary" | "categories">, rule: RuleFacts): boolean {
  const name = fold(event.summary);
  if (rule.words.some((w) => w.trim() !== "" && name.includes(fold(w)))) return true;
  const tags = new Set(event.categories.map(fold));
  return rule.categories.some((c) => c.trim() !== "" && tags.has(fold(c)));
}

const DAY = 86_400_000;

/** Is it time to post this event? It starts in the future, within the rule's lead time. */
export const isPostable = (event: Pick<CalEvent, "start">, now: Date, daysAhead: number): boolean => event.start.getTime() > now.getTime() && event.start.getTime() <= now.getTime() + (daysAhead + 1) * DAY - 1;

/** A fingerprint of what a message shows, so a changed event (moved, renamed, new text) edits its message once. */
export function eventHash(e: CalEvent): string {
  return createHash("sha1").update([e.summary, e.start.toISOString(), e.end?.toISOString() ?? "", e.description, e.image ?? "", e.color ?? ""].join("\u0000")).digest("hex");
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

/** "<t:..:F> (<t:..:R>)" for the start, and the end when there is one: every member sees their own time zone. */
export function whenText(e: Pick<CalEvent, "start" | "end" | "allDay">): { starts: string; ends: string | null } {
  const fmt = (d: Date) => (e.allDay ? `<t:${unix(d)}:D>` : `<t:${unix(d)}:F> (<t:${unix(d)}:R>)`);
  return { starts: fmt(e.start), ends: e.end ? fmt(e.end) : null };
}

/** The message for one event. The calendar's text is escaped (it comes from outside), nothing can ping but the rule's role. */
export function eventMessage(e: CalEvent, pingRoleId: string | null) {
  const { starts, ends } = whenText(e);
  const embed = new EmbedBuilder().setColor(e.color ?? 0x00ffa8).setTitle(truncate(escapeText(e.summary), 256)).addFields({ name: "Starts", value: starts, inline: false });
  if (ends) embed.addFields({ name: "Ends", value: ends, inline: false });
  const text = e.description
    .split("\n")
    .map((l) => escapeText(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text) embed.setDescription(truncate(text, 1500));
  if (e.image) embed.setImage(e.image);
  embed.setFooter({ text: "Event calendar" });
  return {
    content: pingRoleId ? `<@&${pingRoleId}>` : "",
    embeds: [embed],
    allowedMentions: pingRoleId ? { parse: [] as never[], roles: [pingRoleId] } : { parse: [] as never[] },
  };
}

/** Events for the overview: running now or starting within `days`, soonest first. */
export function overviewEvents(events: readonly CalEvent[], now: Date, days: number): CalEvent[] {
  const limit = now.getTime() + days * DAY;
  return events
    .filter((e) => (e.end ?? e.start).getTime() >= now.getTime() && e.start.getTime() <= limit)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** One line per event ("**Name** · <start> - <end>"), at most `max`, with a note for the rest. */
export function overviewLines(events: readonly CalEvent[], max = 25): string[] {
  const lines = events.slice(0, max).map((e) => {
    const end = e.end && !e.allDay ? ` – <t:${unix(e.end)}:d>` : "";
    return `**${escapeText(truncate(e.summary, 60))}** · <t:${unix(e.start)}:d>${end}`;
  });
  if (events.length > max) lines.push(`... and ${events.length - max} more`);
  return lines;
}

export function overviewMessage(events: readonly CalEvent[], days: number) {
  const lines = overviewLines(events);
  const embed = new EmbedBuilder()
    .setColor(0x00ffa8)
    .setTitle("Upcoming events")
    .setDescription(lines.length > 0 ? truncate(lines.join("\n"), 4000) : `Nothing planned in the next ${days} days.`)
    .setFooter({ text: "Event calendar" })
    .setTimestamp();
  return { embeds: [embed], allowedMentions: { parse: [] as never[] } };
}

export const overviewHash = (events: readonly CalEvent[]): string => createHash("sha1").update(overviewLines(events).join("\n")).digest("hex");
