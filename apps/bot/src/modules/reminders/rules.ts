import { MAX_REMINDER_SECONDS, MIN_REMINDER_SECONDS } from "@aboutselphy/shared/reminders";
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
export function reminderLine(r: { id: string; message: string; remindAt: Date }, index: number): string {
  return `**${index + 1}.** <t:${Math.floor(r.remindAt.getTime() / 1000)}:R> · ${truncate(escapeText(r.message), 80)}`;
}
