// A small, defensive reader for the public iCalendar (.ics) feed of an event calendar (the Sea of Thieves calendar is a public Google
// Calendar). Pure, so it is tested with real-looking input. It reads what the calendar actually uses: DTSTART/DTEND (UTC, with a TZID, or a
// date), SUMMARY, DESCRIPTION, UID, STATUS, EXDATE and simple weekly RRULEs. Anything else is ignored, never trusted: hostile input can't make
// it loop (occurrence counts are capped) or allocate much (the caller limits the body size).

export type CalEvent = {
  /** Stable per occurrence: uid + the start time. */
  key: string;
  summary: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  /** Readable text: HTML and the machine part removed. */
  description: string;
  /** Lower-case tags from the calendar's own metadata (for example "twitch_drop", "in_game"). */
  categories: string[];
  /** Only a picture from the calendar's own image host. */
  image: string | null;
  color: number | null;
};

type Prop = { name: string; params: Record<string, string>; value: string };

const MAX_EVENTS = 5000;
const MAX_OCCURRENCES_PER_RULE = 200;
const IMAGE_HOST = /^https:\/\/sea-of-thieves-calendar\.s3[a-z0-9.-]*\.amazonaws\.com\/[^\s"'<>]+$/;

/** Lines continue on the next line when that starts with a space or a tab. */
export function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseProp(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: (name ?? "").toUpperCase(), params, value: line.slice(colon + 1) };
}

/** iCalendar text escapes. */
export const unescapeText = (v: string): string => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** The calendar's descriptions are a little HTML plus a machine part after "||EVENT_INFO||". */
export function splitDescription(raw: string): { text: string; info: Record<string, unknown> } {
  const text0 = unescapeText(raw).replace(/^<html-blob>/, "");
  const at = text0.indexOf("||EVENT_INFO||");
  const human = at >= 0 ? text0.slice(0, at) : text0;
  let info: Record<string, unknown> = {};
  if (at >= 0) {
    // Links inside the JSON are wrapped in <a>, spans are sprinkled in: reduce them to their text first.
    const jsonText = text0
      .slice(at + "||EVENT_INFO||".length)
      .replace(/<a [^>]*>([^<]*)<\/a>/gi, "$1")
      .replace(/<\/?[a-z][^>]*>/gi, "")
      .trim();
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) info = parsed as Record<string, unknown>;
    } catch {
      // unreadable machine part: the event just has no extras
    }
  }
  const text = human
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e.startsWith("#")) {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 31 && code < 0x110000 ? String.fromCodePoint(code) : "";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, info };
}

/** Local wall-clock time in an IANA zone -> UTC. Handles zones with and without daylight saving. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date | null {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const offsetAt = (t: number): number => {
      const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
      return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - t;
    };
    const first = guess - offsetAt(guess);
    return new Date(guess - offsetAt(first));
  } catch {
    return null;
  }
}

type When = { date: Date; allDay: boolean; local: { y: number; mo: number; d: number; h: number; mi: number; s: number }; tz: string | null };

/** DTSTART/DTEND/EXDATE value: "20260918T100000Z", "20260714T030000" with a TZID, or a plain date. */
export function parseWhen(value: string, params: Record<string, string>): When | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const hasTime = m[4] !== undefined;
  const [h, mi, s] = [Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  const local = { y, mo, d, h, mi, s };
  if (!hasTime) return { date: new Date(Date.UTC(y, mo - 1, d)), allDay: true, local, tz: null };
  if (m[7] === "Z" || !params.TZID) return { date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)), allDay: false, local, tz: null };
  const utc = zonedToUtc(y, mo, d, h, mi, s, params.TZID);
  return utc ? { date: utc, allDay: false, local, tz: params.TZID } : null;
}

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** FREQ=WEEKLY with optional INTERVAL, BYDAY and UNTIL. Null for any other rule (it is then treated as a single event). */
function parseWeekly(rule: string): { interval: number; days: number[] | null; until: Date | null } | null {
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=") as [string, string]));
  if (parts.FREQ !== "WEEKLY") return null;
  const interval = Math.max(1, Math.min(52, Number(parts.INTERVAL ?? 1) || 1));
  const days = parts.BYDAY ? parts.BYDAY.split(",").map((d) => DAYS.indexOf(d.replace(/^[+-]?\d*/, ""))).filter((n) => n >= 0) : null;
  let until: Date | null = null;
  if (parts.UNTIL) {
    const w = parseWhen(parts.UNTIL, {});
    until = w?.date ?? null;
  }
  return { interval, days: days && days.length > 0 ? days : null, until };
}

/** Parses the calendar and expands weekly repeats into the window. Cancelled events are dropped. */
export function parseCalendar(text: string, windowStart: Date, windowEnd: Date): CalEvent[] {
  const events: CalEvent[] = [];
  const blocks: Prop[][] = [];
  let current: Prop[] | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") current = [];
    else if (line === "END:VEVENT") {
      if (current) blocks.push(current);
      current = null;
    } else if (current) {
      const p = parseProp(line);
      if (p) current.push(p);
    }
    if (blocks.length >= MAX_EVENTS) break;
  }

  for (const props of blocks) {
    const get = (n: string) => props.find((p) => p.name === n);
    const summary = unescapeText(get("SUMMARY")?.value ?? "").replace(/\s+/g, " ").trim();
    const startProp = get("DTSTART");
    if (!summary || !startProp || get("STATUS")?.value.toUpperCase() === "CANCELLED" || get("RECURRENCE-ID")) continue;
    const start = parseWhen(startProp.value, startProp.params);
    if (!start) continue;
    const endProp = get("DTEND");
    const end = endProp ? parseWhen(endProp.value, endProp.params) : null;
    const durationMs = end ? end.date.getTime() - start.date.getTime() : null;
    const uid = get("UID")?.value ?? summary;
    const { text: description, info } = splitDescription(get("DESCRIPTION")?.value ?? "");
    const filter = Array.isArray(info.filter) ? info.filter.filter((f): f is string => typeof f === "string").map((f) => f.toLowerCase().slice(0, 40)) : [];
    const imageRaw = typeof info.large_image === "string" ? info.large_image : typeof info.small_image === "string" ? info.small_image : "";
    const colorRaw = typeof info["event-color"] === "string" ? /^#([0-9a-f]{6})$/i.exec(info["event-color"]) : null;
    const base = { summary: summary.slice(0, 120), allDay: start.allDay, description: description.slice(0, 3000), categories: filter.slice(0, 10), image: IMAGE_HOST.test(imageRaw) ? imageRaw : null, color: colorRaw ? parseInt(colorRaw[1]!, 16) : null };

    const make = (s: Date): CalEvent => ({ ...base, key: `${uid}|${s.toISOString()}`, start: s, end: durationMs !== null && durationMs > 0 ? new Date(s.getTime() + durationMs) : null });
    const rrule = get("RRULE");
    const weekly = rrule ? parseWeekly(rrule.value) : null;
    if (!weekly) {
      if (start.date.getTime() <= windowEnd.getTime() && (durationMs === null ? start.date : new Date(start.date.getTime() + Math.max(0, durationMs))).getTime() >= windowStart.getTime()) events.push(make(start.date));
      continue;
    }

    // Weekly repeat: walk the local calendar so a time zone with daylight saving keeps its wall-clock time.
    const excluded = new Set(props.filter((p) => p.name === "EXDATE").flatMap((p) => p.value.split(",").map((v) => parseWhen(v, p.params)?.date.getTime() ?? -1)));
    const dayList = weekly.days ?? [new Date(Date.UTC(start.local.y, start.local.mo - 1, start.local.d)).getUTCDay()];
    const weekStart = Date.UTC(start.local.y, start.local.mo - 1, start.local.d) - new Date(Date.UTC(start.local.y, start.local.mo - 1, start.local.d)).getUTCDay() * 86_400_000;
    let produced = 0;
    series: for (let week = 0; week < 2000 && produced < MAX_OCCURRENCES_PER_RULE; week += weekly.interval) {
      for (const dow of dayList) {
        const day = new Date(weekStart + (week * 7 + dow) * 86_400_000);
        const s = start.tz
          ? zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), start.local.h, start.local.mi, start.local.s, start.tz)
          : new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), start.local.h, start.local.mi, start.local.s));
        if (!s || s.getTime() < start.date.getTime() || excluded.has(s.getTime())) continue;
        if (weekly.until && s.getTime() > weekly.until.getTime()) break series;
        const e = make(s);
        const over = (e.end ?? e.start).getTime();
        if (s.getTime() > windowEnd.getTime()) break series;
        if (over >= windowStart.getTime()) {
          events.push(e);
          produced++;
          if (produced >= MAX_OCCURRENCES_PER_RULE) break series;
        }
      }
    }
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}
