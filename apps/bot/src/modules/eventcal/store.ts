import type { CalEvent } from "./ics";

// Mapping between the stored GameEvent rows and the in-memory CalEvent the posting code works with. Pure.

export type StoredLike = {
  key: string;
  title: string;
  kind: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  description: string;
  summary: string;
  blurb: string;
  audience: string;
  items: string[];
  categories: string[];
  imageUrl: string | null;
  videoUrl: string | null;
  color: number | null;
  reminderDays?: number[];
};

const AUDIENCES = ["everyone", "partners", "unknown"] as const;

export function toCalEvent(r: StoredLike): CalEvent {
  const audience = (AUDIENCES as readonly string[]).includes(r.audience) ? (r.audience as (typeof AUDIENCES)[number]) : "unknown";
  return {
    key: r.key,
    summary: r.title,
    start: r.startsAt,
    end: r.endsAt,
    allDay: r.allDay,
    description: r.description,
    categories: r.categories,
    image: r.imageUrl,
    video: r.videoUrl,
    color: r.color,
    kind: r.kind,
    items: r.items,
    ...(r.reminderDays && r.reminderDays.length > 0 ? { reminderDays: r.reminderDays } : {}),
    ...(r.summary ? { extra: { summary: r.summary, blurb: r.blurb, audience } } : {}),
  };
}

/** A best guess of the kind for events that come from a calendar (the AI extraction sets it itself). */
export function inferKind(e: Pick<CalEvent, "summary" | "categories" | "kind">): "drop" | "event" | "update" | "sale" | "other" {
  if (e.kind === "drop" || e.kind === "event" || e.kind === "update" || e.kind === "sale" || e.kind === "other") return e.kind;
  const name = e.summary.toLowerCase();
  if (e.categories.some((c) => c === "twitch_drop" || c === "drop") || /\bdrops?\b/.test(name)) return "drop";
  if (/\b(update|patch)\b/.test(name)) return "update";
  if (/\bsale\b/.test(name)) return "sale";
  return "event";
}

const cut = (s: string | null | undefined, n: number): string => (s ?? "").slice(0, n);

/** The columns to store for an event. */
export function toRow(e: CalEvent) {
  return {
    key: e.key.slice(0, 160),
    title: cut(e.summary, 120) || "Event",
    kind: inferKind(e),
    startsAt: e.start,
    endsAt: e.end,
    allDay: e.allDay,
    description: cut(e.description, 4000),
    summary: cut(e.extra?.summary, 600),
    blurb: cut(e.extra?.blurb, 200),
    audience: e.extra?.audience ?? "unknown",
    items: (e.items ?? []).slice(0, 30).map((i) => i.slice(0, 80)),
    categories: e.categories.slice(0, 10),
    imageUrl: e.image ? e.image.slice(0, 500) : null,
    videoUrl: e.video ? e.video.slice(0, 500) : null,
    color: e.color,
  };
}
