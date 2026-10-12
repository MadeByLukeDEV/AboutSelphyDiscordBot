import { escapeText, truncate } from "../../lib/escape";

// When a birthday is celebrated and what the greeting says. Pure, so the rules are testable.

export type Day = { year: number; month: number; day: number };

/** Today's date in the configured time zone (a day starts at that zone's midnight). */
export function todayIn(now: Date, timeZone: string): Day {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export const dayKey = (d: Day): string => `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** The day a birthday is celebrated in `year`: 29 February moves to 28 February in common years. */
export function celebrationDay(month: number, day: number, year: number): { month: number; day: number } {
  return month === 2 && day === 29 && !isLeapYear(year) ? { month: 2, day: 28 } : { month, day };
}

export function isBirthdayToday(b: { month: number; day: number }, today: Day): boolean {
  const c = celebrationDay(b.month, b.day, today.year);
  return c.month === today.month && c.day === today.day;
}

const utcDay = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / 86_400_000;

/** Whole days from `today` to the next celebration (0 = today). */
export function daysUntil(b: { month: number; day: number }, today: Day): number {
  const from = utcDay(today.year, today.month, today.day);
  for (const year of [today.year, today.year + 1]) {
    const c = celebrationDay(b.month, b.day, year);
    const diff = utcDay(year, c.month, c.day) - from;
    if (diff >= 0) return diff;
  }
  return 366;
}

/** escapeText collapses and trims whitespace; around a placeholder the single spaces at the edges must stay. */
const escapeKeepingEdges = (part: string): string => `${/^\s/.test(part) ? " " : ""}${escapeText(part)}${/\s$/.test(part) && part.trim() !== "" ? " " : ""}`;

/** Fills {user} (a mention), {name} (escaped) and {age} (empty without a birth year); anything else stays as typed, but is escaped too. */
export function renderGreeting(template: string, member: { id: string; name: string }, age: number | null = null): string {
  const parts = template.split(/(\{user\}|\{name\}|\{age\})/);
  const text = parts
    .map((part) => (part === "{user}" ? `<@${member.id}>` : part === "{name}" ? escapeText(truncate(member.name, 60)) : part === "{age}" ? (age === null ? "" : String(age)) : escapeKeepingEdges(part)))
    .join("");
  return truncate(text, 1900);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const formatDay = (month: number, day: number): string => `${day} ${MONTHS[month - 1] ?? "?"}`;

/** The age someone turns this year, or null without a birth year. */
export const ageThisYear = (birthYear: number | null, todayYear: number): number | null => (birthYear === null ? null : todayYear - birthYear);

/**
 * Is the monthly summary due? "seed" = first time (or just switched on): only remember the month, post nothing, so switching it
 * on mid-month never posts out of the blue; "post" = a new month has begun since.
 */
export function summaryDue(monthKey: string, last: string | null): "none" | "seed" | "post" {
  if (last === null) return "seed";
  return last === monthKey ? "none" : "post";
}

export const monthKey = (d: Day): string => `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}`;

const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: number): string => FULL_MONTHS[month - 1] ?? "?";

/** The summary lines ("5 November · @member"), in date order; 29 February shows on the 28th in common years. At most `max`, with a note about the rest. */
export function summaryLines(entries: ReadonlyArray<{ userId: string; month: number; day: number }>, year: number, max = 40): string[] {
  const sorted = entries
    .map((e) => ({ ...e, ...celebrationDay(e.month, e.day, year) }))
    .sort((a, b) => a.day - b.day || a.userId.localeCompare(b.userId));
  const lines = sorted.slice(0, max).map((e) => `**${e.day} ${monthName(e.month)}** · <@${e.userId}>`);
  if (sorted.length > max) lines.push(`... and ${sorted.length - max} more`);
  return lines;
}
