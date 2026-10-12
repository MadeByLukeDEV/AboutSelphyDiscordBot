// What to do with the uploads YouTube reports. Pure, so the rules are testable.

/** A Short is a video of up to 3 minutes (the same rule as the website). */
export const SHORT_MAX_SECONDS = 180;
/** A video older than this is not announced as "new" (e.g. a stream VOD that becomes public a day later). */
export const MAX_ANNOUNCE_AGE_MS = 48 * 60 * 60 * 1000;

/** "PT1H2M3S" -> 3723. Returns null for anything that isn't an ISO 8601 duration. */
export function parseIsoDuration(value: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!match || value === "P" || value.endsWith("T")) return null;
  const [, d, h, m, s] = match;
  return Number(d ?? 0) * 86_400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

/** A premiere / upcoming broadcast is announced when it starts within this long (or started up to an hour ago). */
export const PREMIERE_WINDOW_MS = 14 * 86_400_000;
const PREMIERE_LATE_MS = 3_600_000;

export type UploadCandidate = {
  videoId: string;
  title: string;
  publishedAt: Date;
  durationSeconds: number | null;
  privacy: string; // "public" | "unlisted" | "private"
  /** "none" | "live" | "upcoming" */
  liveState: string;
  /** When an upcoming premiere/broadcast is scheduled to start. */
  scheduledStart?: Date | null;
};

export type UploadDecision =
  | { videoId: string; action: "announce"; isShort: boolean }
  | { videoId: string; action: "remember"; isShort: boolean }
  /** An upcoming premiere/broadcast, announced ahead of time. */
  | { videoId: string; action: "premiere" }
  /** Not final yet (private, live, upcoming): leave it out, it is looked at again next time. */
  | { videoId: string; action: "wait" };

/**
 * For every video the poll returned that isn't in the database yet.
 *  - first run: remember everything silently (never announce a back catalogue)
 *  - not public or still live/upcoming: wait, decide later
 *  - a Short while Shorts are off, or too old: remember silently
 *  - otherwise: announce
 */
export function decideUploads(input: {
  videos: UploadCandidate[];
  knownIds: ReadonlySet<string>;
  firstRun: boolean;
  announceShorts: boolean;
  announcePremieres?: boolean;
  now: Date;
}): UploadDecision[] {
  const out: UploadDecision[] = [];
  for (const v of input.videos) {
    if (input.knownIds.has(v.videoId)) continue;
    const isShort = v.durationSeconds !== null && v.durationSeconds <= SHORT_MAX_SECONDS;
    if (input.announcePremieres && !input.firstRun && v.privacy === "public" && v.liveState === "upcoming" && v.scheduledStart) {
      const until = v.scheduledStart.getTime() - input.now.getTime();
      if (until > -PREMIERE_LATE_MS && until <= PREMIERE_WINDOW_MS) {
        out.push({ videoId: v.videoId, action: "premiere" });
        continue;
      }
    }
    if (v.privacy !== "public" || v.liveState !== "none" || v.durationSeconds === null) {
      out.push({ videoId: v.videoId, action: "wait" });
      continue;
    }
    const tooOld = input.now.getTime() - v.publishedAt.getTime() > MAX_ANNOUNCE_AGE_MS;
    if (input.firstRun || tooOld || (isShort && !input.announceShorts)) out.push({ videoId: v.videoId, action: "remember", isShort });
    else out.push({ videoId: v.videoId, action: "announce", isShort });
  }
  return out;
}

/** The uploads playlist of a channel: "UC" + rest becomes "UU" + rest. Null for an ID that isn't a channel ID. */
export function uploadsPlaylistId(channelId: string): string | null {
  return /^UC[A-Za-z0-9_-]{22}$/.test(channelId) ? `UU${channelId.slice(2)}` : null;
}
