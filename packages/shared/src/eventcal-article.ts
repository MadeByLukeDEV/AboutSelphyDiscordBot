// Reads the text of a monthly "This Month in ..." news article: sections that start with a heading line such as
// "Twitch Drops – Friday, October 23rd – Monday, October 26th" or "Fight Nights – Every Tuesday", followed by the paragraphs about that event.
// Pure and defensive (no Node APIs): the text is pasted by an admin, so it is capped, never executed, and any line it can't understand is skipped.
// The articles carry dates but no times, so these events are all-day.

export const MAX_ARTICLE_CHARS = 40_000;

export type ArticleEvent = {
  title: string;
  /** Midnight UTC of the first day. Null for "Every Tuesday" style entries, which only carry details for a repeating event. */
  start: Date | null;
  /** Midnight UTC of the last day (inclusive), or null for a single day. */
  end: Date | null;
  /** The weekday of an "Every <day>" entry (0 = Sunday). */
  everyWeekday: number | null;
  /** The article's paragraphs about the event, plain text. */
  text: string;
  /** Lower-case tags we can safely infer from the name (for example twitch_drop). */
  categories: string[];
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DATE = String.raw`(?:(?:${WEEKDAYS.join("|")}),?\s+)?(${MONTHS.join("|")})\s+(\d{1,2})(?:st|nd|rd|th)?`;
const RANGE_RE = new RegExp(`^(?:until\\s+)?${DATE}(?:\\s*[–-]\\s*${DATE})?$`, "i");
const EVERY_RE = new RegExp(`^every\\s+(${WEEKDAYS.join("|")})s?$`, "i");
const SIGN_OFF = /\b(we hope|see you again|we'll see you|until next time|catch you then|follow along|check in on)\b/i;

/** The year an article belongs to: "on 06 Oct 2026" in its byline, or a year next to a month in the title or text. */
export function articleYear(text: string): number | null {
  const posted = /\bon\s+\d{1,2}\s+[A-Za-z]{3,9}\s+(20\d{2})\b/.exec(text);
  if (posted) return Number(posted[1]);
  const titled = new RegExp(`(?:${MONTHS.join("|")})\\s+(20\\d{2})`, "i").exec(text);
  return titled ? Number(titled[1]) : null;
}

const utcDay = (year: number, month: number, day: number): Date | null => {
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCMonth() === month && d.getUTCDate() === day ? d : null;
};

function inferCategories(title: string): string[] {
  const t = title.toLowerCase();
  return t.includes("twitch drop") ? ["twitch_drop"] : [];
}

/** Splits "Title – dates" at the dash that starts the date part. Null when the right-hand side isn't a date, a range or "Every <weekday>". */
function parseHeading(line: string, year: number): Omit<ArticleEvent, "text"> | null {
  if (line.length > 140) return null;
  const parts = line.split(/\s+[–-]\s+/);
  for (let i = 1; i < parts.length; i++) {
    const title = parts.slice(0, i).join(" – ").trim();
    const rest = line.slice(line.indexOf(parts[i]!, title.length)).trim();
    if (!title) continue;
    const every = EVERY_RE.exec(rest);
    if (every) return { title, start: null, end: null, everyWeekday: WEEKDAYS.indexOf(every[1]!.toLowerCase()), categories: inferCategories(title) };
    const range = RANGE_RE.exec(rest);
    if (!range) continue;
    const m1 = MONTHS.indexOf(range[1]!.toLowerCase());
    const start = utcDay(year, m1, Number(range[2]));
    if (!start) continue;
    let end: Date | null = null;
    if (range[3] && range[4]) {
      const m2 = MONTHS.indexOf(range[3].toLowerCase());
      // A range can run into the next year ("December 30th – January 2nd").
      end = utcDay(m2 < m1 ? year + 1 : year, m2, Number(range[4]));
      if (!end || end.getTime() < start.getTime()) end = null;
    }
    return { title, start, end, everyWeekday: null, categories: inferCategories(title) };
  }
  return null;
}

/** All events of an article. `year` comes from articleYear unless given. Returns [] for text it can't use. */
export function parseArticle(raw: string, yearOverride?: number): ArticleEvent[] {
  const text = raw.slice(0, MAX_ARTICLE_CHARS).replace(/\r\n/g, "\n");
  const year = yearOverride ?? articleYear(text);
  if (!year) return [];
  const lines = text.split("\n").map((l) => l.trim());

  // Video captions look like "Title\nDuration 13:40": drop both lines.
  const cleaned: string[] = [];
  for (const line of lines) {
    if (/^duration\s+\d{1,2}:\d{2}$/i.test(line)) {
      while (cleaned.length > 0 && cleaned.at(-1) === "") cleaned.pop();
      cleaned.pop();
      continue;
    }
    cleaned.push(line);
  }

  const events: ArticleEvent[] = [];
  let current: { head: Omit<ArticleEvent, "text">; paragraphs: string[] } | null = null;
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0 && current) current.paragraphs.push(paragraph.join(" "));
    paragraph = [];
  };
  const close = () => {
    flush();
    if (!current) return;
    const paragraphs = [...current.paragraphs];
    while (paragraphs.length > 1 && SIGN_OFF.test(paragraphs.at(-1)!)) paragraphs.pop();
    events.push({ ...current.head, text: paragraphs.slice(0, 4).join("\n\n").slice(0, 1500) });
    current = null;
  };

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i]!;
    const next = cleaned[i + 1];
    // A heading stands alone on its line, with a blank line after it.
    const head = line !== "" && (next === "" || next === undefined) ? parseHeading(line, year) : null;
    if (head) {
      close();
      current = { head, paragraphs: [] };
    } else if (line === "") {
      flush();
    } else if (current) {
      paragraph.push(line);
    }
  }
  close();
  return events;
}
