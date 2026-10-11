// What to do after a (re)connect, to repair whatever happened while the bot was
// down or the socket was dead. Pure: the caller does the I/O.

/** A stream that started longer ago than this is not announced late. */
export const LATE_ANNOUNCE_WINDOW_MS = 15 * 60_000;

/**
 * A channel counts as "known" for a stream when we already announced it before, or when it was added
 * before this stream started: then the stream is genuinely new, not one that was live when the channel
 * was added. Without the second rule the very first stream of a freshly added channel is baselined
 * silently, which for channels that are only polled (no events) means no announcement ever.
 */
export const addedBeforeStart = (addedAt: Date, startedAt: Date): boolean => addedAt.getTime() < startedAt.getTime();

export type LiveNow = { id: string; userId: string; startedAt: Date };
export type OpenRow = { id: string; twitchStreamId: string; twitchUserId: string };

export type ReconcilePlan = {
  /** Live and not announced yet, recent enough, and the channel has been seen before. */
  announce: LiveNow[];
  /** Live and not recorded: remembered silently, nothing posted (first run, or too old to announce). */
  baseline: LiveNow[];
  /** Recorded as open, but no longer live: mark ended (and edit the message). */
  close: OpenRow[];
};

export function planReconcile(input: {
  live: LiveNow[];
  open: OpenRow[];
  /** Stream ids that already have a row (open or ended). */
  knownStreamIds: Set<string>;
  /** Channels that have at least one row: only these are announced late, a brand-new channel is baselined. */
  channelsWithHistory: Set<string>;
  now: Date;
}): ReconcilePlan {
  const liveIds = new Set(input.live.map((s) => s.id));
  const plan: ReconcilePlan = { announce: [], baseline: [], close: [] };

  for (const stream of input.live) {
    if (input.knownStreamIds.has(stream.id)) continue;
    const recent = input.now.getTime() - stream.startedAt.getTime() <= LATE_ANNOUNCE_WINDOW_MS;
    if (recent && input.channelsWithHistory.has(stream.userId)) plan.announce.push(stream);
    else plan.baseline.push(stream);
  }
  for (const row of input.open) {
    if (!liveIds.has(row.twitchStreamId)) plan.close.push(row);
  }
  return plan;
}
