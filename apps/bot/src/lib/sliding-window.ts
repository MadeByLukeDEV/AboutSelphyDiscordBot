/**
 * "At most `max` per `windowMs`" per key, as a sliding window. Used where
 * Discord has its own limit we must not run into: renaming a channel is
 * limited to 2 per 10 minutes, and past that discord.js doesn't fail, it
 * queues the request and the member's button just hangs.
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a use and returns true, or returns false (recording nothing) when the limit is reached. */
  tryAcquire(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => t - at < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }

  /** Seconds until the next use is allowed (0 when one is available now). */
  retryAfterSeconds(key: string): number {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => t - at < this.windowMs);
    if (recent.length < this.max) return 0;
    const oldest = recent[0]!;
    return Math.max(1, Math.ceil((oldest + this.windowMs - t) / 1000));
  }

  /** Forget a key (the room was deleted). */
  clear(key: string): void {
    this.hits.delete(key);
  }
}
