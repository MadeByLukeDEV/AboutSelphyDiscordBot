"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function format(startIso: string, endIso: string | null, allDay: boolean, timeZone: string | undefined, locale: string): string {
  // All-day events are calendar days, not moments: always read them in UTC so they never slide to another day.
  const zone = allDay ? "UTC" : timeZone;
  const day = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: zone });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: zone });
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const a = allDay ? day.format(start) : `${day.format(start)} ${time.format(start)}`;
  if (!end) return a;
  const b = allDay ? day.format(end) : `${day.format(end)} ${time.format(end)}`;
  return a === b ? a : `${a} – ${b}`;
}

/** A date range in the viewer's own time zone (UTC while rendering on the server, then corrected in the browser). */
export function LocalRange({ start, end, allDay, locale }: { start: string; end: string | null; allDay: boolean; locale: string }) {
  const zone = useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
  return <time dateTime={start}>{format(start, end, allDay, zone, locale)}{zone === "UTC" && !allDay ? " UTC" : ""}</time>;
}
