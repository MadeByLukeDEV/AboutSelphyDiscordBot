import { createHash } from "node:crypto";
import { EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";
import type { ArticleEvent } from "@aboutselphy/shared/eventcal-article";
import type { CalEvent } from "./ics";
import type { EventSummaryData } from "./summary";

// Which events a rule posts, when, and what the messages look like. Pure, so the rules are testable.

export type RuleFacts = { words: readonly string[]; categories: readonly string[]; kinds?: readonly string[] };

const fold = (t: string): string => t.normalize("NFKC").toLowerCase();

/** An event matches a rule when its name contains one of the rule's words, it carries one of the rule's tags, or it is of one of the rule's kinds. Words are plain text, never patterns. */
export function matchesRule(event: Pick<CalEvent, "summary" | "categories" | "kind">, rule: RuleFacts): boolean {
  if (event.kind && (rule.kinds ?? []).includes(event.kind)) return true;
  const name = fold(event.summary);
  if (rule.words.some((w) => w.trim() !== "" && name.includes(fold(w)))) return true;
  const tags = new Set(event.categories.map(fold));
  return rule.categories.some((c) => c.trim() !== "" && tags.has(fold(c)));
}

const DAY = 86_400_000;

/** Is it time to post this event? It starts in the future, within the rule's lead time. */
export function isPostable(event: Pick<CalEvent, "start" | "allDay">, now: Date, daysAhead: number): boolean {
  // A date-only event starts at midnight UTC; it stays postable for that whole day.
  const from = event.allDay ? Math.floor(now.getTime() / DAY) * DAY : now.getTime() + 1;
  return event.start.getTime() >= from && event.start.getTime() <= now.getTime() + (daysAhead + 1) * DAY - 1;
}

/** Lead times in days: whole numbers 0-60, no duplicates, largest first. Falls back to one week when there are none. */
export function normalizeOffsets(days: readonly number[]): number[] {
  const clean = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 60))].sort((a, b) => b - a);
  return clean.length > 0 ? clean : [7];
}

export type StagePlan = { stage: number; offset: number; post: boolean };

/**
 * Which of an event's lead times are due now. Stage 0 is the largest lead time. Only the nearest due one is posted; earlier ones that were missed
 * (the rule was made late, the bot was down) are marked as done silently, so a late event never gets two posts at once.
 */
export function planStages(event: Pick<CalEvent, "start" | "allDay">, now: Date, offsets: readonly number[]): StagePlan[] {
  const due = normalizeOffsets(offsets)
    .map((offset, stage) => ({ stage, offset }))
    .filter((s) => isPostable(event, now, s.offset));
  if (due.length === 0) return [];
  const nearest = Math.min(...due.map((s) => s.offset));
  return due.map((s) => ({ ...s, post: s.offset === nearest }));
}

/** A fingerprint of what a message shows, so a changed event (moved, renamed, new text) edits its message once. */
export function eventHash(e: CalEvent): string {
  return createHash("sha1").update([e.summary, e.start.toISOString(), e.recurrence ? "" : (e.end?.toISOString() ?? ""), e.description, e.image ?? "", e.video ?? "", e.color ?? "", e.extra?.summary ?? "", (e.items ?? []).join("|")].join("\u0000")).digest("hex");
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

/** "<t:..:F> (<t:..:R>)" for the start, and the end when there is one: every member sees their own time zone. */
export function whenText(e: Pick<CalEvent, "start" | "end" | "allDay">): { starts: string; ends: string | null } {
  const fmt = (d: Date) => (e.allDay ? `<t:${unix(d)}:D>` : `<t:${unix(d)}:F> (<t:${unix(d)}:R>)`);
  return { starts: fmt(e.start), ends: e.end ? fmt(e.end) : null };
}

/**
 * The message for one event. The calendar's text is escaped (it comes from outside), nothing can ping but the rule's role. A reminder (a later lead
 * time of the same rule) gets a line saying when the event starts.
 */
export function eventMessage(e: CalEvent, pingRoleId: string | null, ai: EventSummaryData | null = null, opts: { reminder?: boolean; cardName?: string } = {}) {
  const { starts, ends } = whenText(e);
  // An occurrence of a repeating series: the next time, and how it repeats (its end is the last occurrence's, which isn't this one's).
  const embed = new EmbedBuilder().setColor(e.color ?? 0x00ffa8).setTitle(truncate(escapeText(e.summary), 256)).addFields({ name: e.recurrence ? "Next" : "Starts", value: starts, inline: false });
  if (e.recurrence) embed.addFields({ name: "Repeats", value: escapeText(e.recurrence), inline: false });
  else if (ends) embed.addFields({ name: "Ends", value: ends, inline: false });
  // With an AI summary the post shows it, the rewards and who can take part; otherwise the event's own text.
  const text = (ai ? ai.summary : e.description)
    .split("\n")
    .map((l) => escapeText(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text) embed.setDescription(truncate(text, 1500));
  if (ai && ai.rewards.length > 0) embed.addFields({ name: "Rewards", value: truncate(ai.rewards.map((r) => `• **${escapeText(r)}**`).join("\n"), 1000) });
  if (ai && ai.audience !== "unknown") embed.addFields({ name: "Who can take part", value: ai.audience === "everyone" ? "Everyone — partnered or not" : "Partnered streamers only" });
  // A drawn card (attached by the caller) replaces the plain picture.
  if (opts.cardName) embed.setImage(`attachment://${opts.cardName}`);
  else if (e.image) embed.setImage(e.image);
  embed.setFooter({ text: ai ? "Event calendar · summary by AI" : "Event calendar" });
  // A video link goes in the text so Discord shows its player under the embed.
  const lead = [pingRoleId ? `<@&${pingRoleId}>` : "", opts.reminder ? `⏰ **Reminder:** starts <t:${unix(e.start)}:R>` : ""].filter(Boolean).join(" ");
  const content = [lead, e.video ?? ""].filter(Boolean).join("\n");
  return {
    content,
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

const KIND_ICON: Record<string, string> = { drop: "🎁", event: "🎉", update: "🛠️", sale: "🏷️", other: "📌" };
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (d: Date): string => `${DAY_ABBR[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]}`;
const dayNumber = (d: Date): number => Math.floor(d.getTime() / DAY);

/** When an event runs, short and readable: "Fri 23 Oct – Mon 26 Oct", "Thu 22 Oct", or (events with a time) the viewer's own time through Discord. */
export function overviewWhen(e: CalEvent): string {
  if (!e.allDay) return `<t:${unix(e.start)}:f>${e.end ? ` → <t:${unix(e.end)}:t>` : ""}`;
  return e.end && dayNumber(e.end) > dayNumber(e.start) ? `${shortDay(e.start)} – ${shortDay(e.end)}` : shortDay(e.start);
}

/** The moment an event is over: a date-only event lasts until the end of its last day. */
const overAt = (e: CalEvent): number => (e.allDay ? (e.end ?? e.start).getTime() + DAY : (e.end ?? e.start).getTime());

/** One event as two lines: its name with a kind icon, then when it runs and a relative time ("in 8 days" / "ends in 3 days"). */
export function overviewEntry(e: CalEvent, now: Date): string {
  const icon = e.recurrence ? "🔁" : (KIND_ICON[e.kind ?? "event"] ?? "🎉");
  const name = `${icon} **${escapeText(truncate(e.summary, 70))}**`;
  if (e.recurrence) return `${name}\n${escapeText(e.recurrence)}`;
  const running = e.start.getTime() <= now.getTime();
  const relative = running ? (overAt(e) > now.getTime() && (e.end || e.allDay) ? ` · ends <t:${Math.floor(overAt(e) / 1000)}:R>` : "") : ` · starts <t:${unix(e.start)}:R>`;
  return `${name}\n${overviewWhen(e)}${relative}`;
}

export type OverviewSection = { title: string; entries: string[] };

/** The overview in sections: happening now, the next seven days, later, and repeating entries. At most `max` events in all, with a note for the rest. */
export function overviewSections(events: readonly CalEvent[], now: Date, max = 25): OverviewSection[] {
  const nowMs = now.getTime();
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const groups: Array<{ title: string; list: CalEvent[] }> = [
    { title: "🟢 Happening now", list: sorted.filter((e) => !e.recurrence && e.start.getTime() <= nowMs) },
    { title: "📅 Next 7 days", list: sorted.filter((e) => !e.recurrence && e.start.getTime() > nowMs && e.start.getTime() <= nowMs + 7 * DAY) },
    { title: "🗓️ Later", list: sorted.filter((e) => !e.recurrence && e.start.getTime() > nowMs + 7 * DAY) },
    { title: "🔁 Repeating", list: sorted.filter((e) => e.recurrence) },
  ];
  let left = max;
  let cut = 0;
  const out: OverviewSection[] = [];
  for (const g of groups) {
    if (g.list.length === 0) continue;
    const take = g.list.slice(0, Math.max(left, 0));
    cut += g.list.length - take.length;
    left -= take.length;
    if (take.length > 0) out.push({ title: g.title, entries: take.map((e) => overviewEntry(e, now)) });
  }
  if (cut > 0 && out.length > 0) out[out.length - 1]!.entries.push(`… and ${cut} more`);
  return out;
}

/** Field values hold at most 1024 characters: a long section continues in another field. */
function chunkEntries(entries: readonly string[], limit = 1000): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const entry of entries) {
    const next = current ? `${current}\n\n${entry}` : entry;
    if (next.length > limit && current) {
      chunks.push(current);
      current = entry;
    } else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function overviewMessage(events: readonly CalEvent[], days: number, now: Date, color = 0x00ffa8) {
  const sections = overviewSections(events, now);
  const embed = new EmbedBuilder().setColor(color).setTitle("Upcoming events").setFooter({ text: "Event calendar" }).setTimestamp();
  if (sections.length === 0) embed.setDescription(`Nothing planned in the next ${days} days.`);
  else {
    embed.setDescription(`The next ${days} days`);
    for (const section of sections) chunkEntries(section.entries).forEach((value, i) => embed.addFields({ name: i === 0 ? section.title : `${section.title} (continued)`, value, inline: false }));
  }
  return { embeds: [embed], allowedMentions: { parse: [] as never[] } };
}

/** A fingerprint of what the overview shows, so the message is only edited when it changes (including an event moving to another section). */
export const overviewHash = (events: readonly CalEvent[], now: Date): string => createHash("sha1").update(JSON.stringify(overviewSections(events, now))).digest("hex");

const norm = (t: string): string => fold(t).replace(/[^a-z0-9]+/g, "");
/** "Twitch Drops" and "Season 21 Community Weekend" vs "Community Weekend": one name contains the other. */
const sameName = (a: string, b: string): boolean => {
  const x = norm(a);
  const y = norm(b);
  return x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x));
};
const dayMs = (d: Date): number => Math.floor(d.getTime() / DAY) * DAY;

/** Copies what an article section knows onto an event: its text, picture, video and (from the AI extraction) kind, items, summary and audience. */
function applyArticle(e: CalEvent, a: ArticleEvent): void {
  if (a.text) e.description = a.text;
  if (a.image) e.image = a.image;
  if (a.video) e.video = a.video;
  if (a.kind) e.kind = a.kind;
  if (a.items && a.items.length > 0) e.items = a.items;
  if (a.summary) e.extra = { summary: a.summary, blurb: a.blurb ?? "", audience: a.audience ?? "unknown" };
}

/**
 * Combines the calendar with a monthly news article. The article has the dates and the details of everything planned (the calendar often lacks
 * entries, and its texts are short): a calendar event with the same name on those days keeps its exact times but gets the article's text; an
 * "Every Tuesday" section gives its text to every event of that name; a dated section the calendar doesn't have becomes an all-day event of its own.
 */
export function mergeArticle(calendar: readonly CalEvent[], articleEvents: readonly ArticleEvent[], windowStart: Date, windowEnd: Date): CalEvent[] {
  const out = calendar.map((e) => ({ ...e }));
  for (const a of articleEvents) {
    if (a.everyWeekday !== null) {
      for (const e of out) {
        if (!sameName(e.summary, a.title)) continue;
        applyArticle(e, a);
      }
      continue;
    }
    if (!a.start) continue;
    const last = a.end ?? a.start;
    const matches = out.filter((e) => sameName(e.summary, a.title) && dayMs(e.start) >= a.start!.getTime() - DAY && dayMs(e.start) <= last.getTime() + DAY);
    if (matches.length > 0) {
      for (const e of matches) applyArticle(e, a);
      continue;
    }
    if (last.getTime() + DAY < windowStart.getTime() || a.start.getTime() > windowEnd.getTime()) continue;
    const added: CalEvent = {
      key: `article|${norm(a.title)}|${a.start.toISOString().slice(0, 10)}`,
      summary: a.title.slice(0, 120),
      start: a.start,
      end: a.end,
      allDay: true,
      description: a.text,
      categories: a.categories,
      image: a.image,
      video: a.video,
      color: null,
    };
    applyArticle(added, a);
    out.push(added);
  }
  return out.sort((x, y) => x.start.getTime() - y.start.getTime());
}

// ---- the detailed monthly summary: every event of a month (not only those a rule matches), one line each, repeating events folded ----

export type MonthlyEntry = { event: CalEvent; weekly: number | null };

/** Events that run during the given UTC month (a running event counts in every month it touches). */
export function monthEvents(events: readonly CalEvent[], year: number, month: number): CalEvent[] {
  const from = Date.UTC(year, month - 1, 1);
  const to = Date.UTC(year, month, 1);
  return events.filter((e) => e.start.getTime() < to && (e.end ?? e.start).getTime() >= from).sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Three or more events of the same name exactly a week apart become one "every <weekday>" entry; everything else stays single. */
export function monthlyEntries(events: readonly CalEvent[]): MonthlyEntry[] {
  const groups = new Map<string, CalEvent[]>();
  for (const e of events) (groups.get(norm(e.summary)) ?? groups.set(norm(e.summary), []).get(norm(e.summary))!).push(e);
  const folded = new Set<CalEvent>();
  const entries: MonthlyEntry[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.start.getTime() - b.start.getTime());
    const weekly = sorted.length >= 3 && sorted.every((e, i) => i === 0 || Math.abs(e.start.getTime() - sorted[i - 1]!.start.getTime() - 7 * DAY) <= 3_600_000);
    if (!weekly) continue;
    for (const e of sorted) folded.add(e);
    entries.push({ event: sorted[0]!, weekly: sorted[0]!.start.getUTCDay() });
  }
  for (const e of events) if (!folded.has(e)) entries.push({ event: e, weekly: null });
  return entries.sort((a, b) => a.event.start.getTime() - b.event.start.getTime());
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The first whole sentences of a text that fit `max` characters (the first one cut if it alone is too long): the fallback line when there is no AI blurb. */
export function firstSentence(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentences = flat.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [flat];
  let out = "";
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence.trim()}` : sentence.trim();
    if (next.length > max) break;
    out = next;
  }
  return out || truncate(flat, max);
}

/** One entry as text: "**Name** · <date> – <date>" and, below, its one-line blurb. Everything from outside is escaped. */
export function monthlyLine(entry: MonthlyEntry, blurb: string): string {
  const { event: e } = entry;
  let when: string;
  if (e.recurrence) when = escapeText(e.recurrence);
  else if (entry.weekly !== null) when = `every ${WEEKDAY_NAMES[entry.weekly]}`;
  else {
    const endsLater = e.end && Math.floor(e.end.getTime() / DAY) > Math.floor(e.start.getTime() / DAY);
    // A date-only range ends on its last day itself; a timed range ends when the clock says (so the last day is the day before midnight).
    const last = e.end && endsLater ? (e.allDay ? e.end : new Date(e.end.getTime() - 1)) : null;
    const lastDay = last && Math.floor(last.getTime() / DAY) > Math.floor(e.start.getTime() / DAY) ? last : null;
    when = `<t:${unix(e.start)}:D>${lastDay ? ` – <t:${unix(lastDay)}:D>` : ""}`;
  }
  const line = `**${escapeText(truncate(e.summary, 80))}** · ${when}`;
  const b = blurb.trim() ? `\n> ${escapeText(truncate(blurb, 300))}` : "";
  return line + b;
}

const MAX_EMBED_TEXT = 3800;
const MAX_MESSAGE_CHARS = 5200;
const MAX_EMBEDS = 10;

/** Packs the lines into as few messages as fit Discord's limits (embed text, 6000 characters and 10 embeds per message). */
export function monthlyMessages(lines: readonly string[], monthLabel: string) {
  const messages: Array<{ embeds: EmbedBuilder[]; allowedMentions: { parse: never[] } }> = [];
  let embeds: EmbedBuilder[] = [];
  let used = 0;
  let text = "";
  const titleOf = () => (messages.length === 0 && embeds.length === 0 ? `${monthLabel}: what's on` : null);
  const flushEmbed = () => {
    if (text === "") return;
    const e = new EmbedBuilder().setColor(0x00ffa8).setDescription(text.trim());
    const t = titleOf();
    if (t) e.setTitle(t);
    embeds.push(e);
    used += text.length + (t?.length ?? 0);
    text = "";
  };
  const flushMessage = () => {
    flushEmbed();
    if (embeds.length > 0) messages.push({ embeds, allowedMentions: { parse: [] } });
    embeds = [];
    used = 0;
  };
  for (const line of lines) {
    if (text.length + line.length + 2 > MAX_EMBED_TEXT) flushEmbed();
    if (embeds.length >= MAX_EMBEDS || used + text.length + line.length + 2 > MAX_MESSAGE_CHARS) flushMessage();
    text += `${line}\n\n`;
  }
  flushMessage();
  if (messages.length === 0) {
    messages.push({ embeds: [new EmbedBuilder().setColor(0x00ffa8).setTitle(`${monthLabel}: what's on`).setDescription("Nothing is planned yet.")], allowedMentions: { parse: [] } });
  }
  messages.at(-1)!.embeds.at(-1)!.setFooter({ text: "Event calendar" });
  return messages;
}

export const monthlyHash = (lines: readonly string[]): string => createHash("sha1").update(lines.join("\n\n")).digest("hex");

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (year: number, month: number): string => `${MONTH_NAMES[month - 1]} ${year}`;

// ---- repeating series: dozens of occurrences of the same calendar entry become one entry

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Every day", "Every Tuesday", "Every other Tuesday" or "Every N days", from the gap between two occurrences. */
export function recurrenceText(first: Date, gapMs: number): string {
  const days = Math.round(gapMs / DAY);
  if (days === 1) return "Every day";
  if (days === 7) return `Every ${WEEKDAYS[first.getUTCDay()]}`;
  if (days === 14) return `Every other ${WEEKDAYS[first.getUTCDay()]}`;
  return `Every ${days} days`;
}

/**
 * Turns calendar entries that repeat at an even interval (at least three of the same name) into ONE entry that stands for the series: it starts at
 * the next occurrence, runs to the last one, and says how it repeats. Article entries and everything that doesn't repeat evenly are left as they are.
 */
export function foldSeries(events: readonly CalEvent[], now: Date): CalEvent[] {
  const groups = new Map<string, CalEvent[]>();
  const rest: CalEvent[] = [];
  for (const e of events) {
    if (e.key.startsWith("article|") || e.recurrence) rest.push(e);
    else (groups.get(norm(e.summary)) ?? groups.set(norm(e.summary), []).get(norm(e.summary))!).push(e);
  }
  const out = [...rest];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.start.getTime() - b.start.getTime());
    const gap = sorted.length >= 3 ? sorted[1]!.start.getTime() - sorted[0]!.start.getTime() : 0;
    const even = gap >= DAY - 3_600_000 && sorted.every((e, i) => i === 0 || Math.abs(e.start.getTime() - sorted[i - 1]!.start.getTime() - gap) <= 3_600_000);
    if (!even) {
      out.push(...sorted);
      continue;
    }
    const upcoming = sorted.find((e) => (e.end ?? e.start).getTime() >= now.getTime()) ?? sorted[sorted.length - 1]!;
    const last = sorted[sorted.length - 1]!;
    out.push({ ...upcoming, key: `series|${norm(upcoming.summary)}`.slice(0, 160), end: last.end ?? last.start, recurrence: recurrenceText(upcoming.start, gap) });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

