// Pure parts of raid protection: counting joins in a window and what the settings mean.

/** Keeps only the joins inside the window (newest last). */
export function recentJoins(times: readonly number[], now: number, windowSeconds: number): number[] {
  return times.filter((t) => now - t < windowSeconds * 1000 && t <= now);
}

/** Whether this many recent joins is a raid. */
export const isRaid = (joinsInWindow: number, threshold: number): boolean => joinsInWindow >= threshold;

/** Is raid mode still on at `now`? */
export const raidActive = (until: Date | null, now: Date): boolean => until !== null && until.getTime() > now.getTime();

/** The reason that goes into the case and the audit log. */
export const RAID_REASON = "Joined during a raid";
