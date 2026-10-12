// Pure parts of the data tools: when something is old enough to remove, and what a member's export may contain.

const DAY_MS = 86_400_000;

/** The moment before which data is "old", or null when retention is off (0 days = keep). */
export function cutoff(days: number, now: Date): Date | null {
  return Number.isInteger(days) && days > 0 ? new Date(now.getTime() - days * DAY_MS) : null;
}

export type PruneResult = { transcripts: number; cases: number; suggestions: number; xp: number };

/** One line for the dashboard: what the last run removed. */
export function describeRun(result: PruneResult): string {
  return `transcripts ${result.transcripts}, cases ${result.cases}, suggestions ${result.suggestions}, level records ${result.xp}`;
}

/** Strings in an export are cut so a huge row can't make the file or the reply too large. */
export const clip = (text: string | null | undefined, max = 500): string => (text ?? "").slice(0, max);
