// Choosing which messages /purge deletes. Pure, so the rules are testable.

/** Discord refuses to bulk delete messages older than 14 days; stay a little inside that. */
export const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 - 60_000;

/** The most /purge will look through to find matches (a filter can make the matches sparse). */
export const MAX_SCAN = 500;
export const MAX_PURGE = 100;

export type PurgeCandidate = { id: string; authorId: string; authorIsBot: boolean; createdAt: number; pinned: boolean };

export type PurgeFilter = {
  /** How many messages to delete at most. */
  count: number;
  /** Only this member's messages. */
  userId?: string | null;
  /** Only messages from bots. */
  botsOnly?: boolean;
  now: number;
};

/**
 * From newest to oldest: the messages to delete. Pinned messages are never
 * touched, and nothing too old for a bulk delete is picked (it would make
 * Discord reject the whole batch).
 */
export function selectForPurge(messages: PurgeCandidate[], filter: PurgeFilter): string[] {
  const picked: string[] = [];
  for (const m of messages) {
    if (picked.length >= filter.count) break;
    if (m.pinned) continue;
    if (filter.now - m.createdAt > BULK_DELETE_MAX_AGE_MS) continue;
    if (filter.userId && m.authorId !== filter.userId) continue;
    if (filter.botsOnly && !m.authorIsBot) continue;
    picked.push(m.id);
  }
  return picked;
}
