import { MAX_REMINDER_SECONDS, MAX_REPEAT_SECONDS, MIN_REMINDER_SECONDS, MIN_REPEAT_SECONDS } from "@aboutselphy/shared/reminders";
import { escapeText, truncate } from "../../lib/escape";

// What a reminder may be and what it says when it arrives. Pure, so the rules are testable.

/** A duration in seconds is allowed from 1 minute to 1 year. */
export const isAllowedDelay = (seconds: number | null): seconds is number => seconds !== null && seconds >= MIN_REMINDER_SECONDS && seconds <= MAX_REMINDER_SECONDS;

/** The text of a delivered reminder. The member's words are escaped, so a reminder can't ping anyone but its owner. */
export function reminderText(r: { userId: string; message: string; remindAt: Date }, now: Date, jumpHint?: string): string {
  const lateMs = now.getTime() - r.remindAt.getTime();
  const late = lateMs > 10 * 60_000 ? ` *(set for <t:${Math.floor(r.remindAt.getTime() / 1000)}:f>, the bot was away)*` : "";
  const body = truncate(escapeText(r.message), 1500);
  return `⏰ <@${r.userId}> reminder: ${body}${late}${jumpHint ? `\n${jumpHint}` : ""}`;
}

/** One line for /remind list. */
export function reminderLine(r: { id: string; message: string; remindAt: Date; repeatEverySeconds?: number | null; repeatsLeft?: number }, index: number): string {
  const repeat = r.repeatEverySeconds && (r.repeatsLeft ?? 0) > 0 ? ` · repeats ${r.repeatsLeft} more ${r.repeatsLeft === 1 ? "time" : "times"}` : "";
  return `**${index + 1}.** <t:${Math.floor(r.remindAt.getTime() / 1000)}:R> · ${truncate(escapeText(r.message), 80)}${repeat}`;
}

// -- repeating ---------------------------------------------------------------------------------------------

/** A repeat interval is allowed from 1 hour to 1 year. */
export const isAllowedRepeat = (seconds: number | null): seconds is number => seconds !== null && seconds >= MIN_REPEAT_SECONDS && seconds <= MAX_REPEAT_SECONDS;

/**
 * When the next occurrence is: the scheduled time plus a whole number of intervals (so a daily reminder stays at the same time of
 * day), skipping the ones already past if the bot was away.
 */
export function nextOccurrence(remindAt: Date, everySeconds: number, now: Date): Date {
  const step = everySeconds * 1000;
  const behind = Math.max(0, now.getTime() - remindAt.getTime());
  return new Date(remindAt.getTime() + (Math.floor(behind / step) + 1) * step);
}

// -- snoozing ------------------------------------------------------------------------------------------------

export const REMINDER_PREFIX = "rm";
/** The snooze buttons: ten minutes, an hour, a day. */
export const SNOOZE_MINUTES = [10, 60, 1440] as const;
export const snoozeControlId = (id: string, minutes: number) => `${REMINDER_PREFIX}:snooze:${id}:${minutes}`;

/** Strict parse of a snooze button: only our own shape, an id-looking part and one of the offered lengths. */
export function parseSnooze(customId: string): { id: string; minutes: number } | null {
  const m = /^rm:snooze:([a-z0-9]{10,40}):(\d{1,4})$/.exec(customId);
  const minutes = m ? Number(m[2]) : 0;
  return m && (SNOOZE_MINUTES as readonly number[]).includes(minutes) ? { id: m[1]!, minutes } : null;
}

export const snoozeLabel = (minutes: number): string => (minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${minutes / 60} h` : `${minutes / 1440} day`);
