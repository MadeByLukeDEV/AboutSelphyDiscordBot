/**
 * A per-key cooldown: `tryAcquire` returns true and starts the cooldown, or
 * false while the key is still cooling down. In memory only, which is right for
 * a short anti-spam delay (a restart simply resets it).
 */
export class Cooldown {
  private last = new Map<string, number>();

  constructor(
    private readonly ms: number,
    private readonly now: () => number = Date.now,
  ) {}

  tryAcquire(key: string): boolean {
    const t = this.now();
    const previous = this.last.get(key);
    if (previous !== undefined && t - previous < this.ms) return false;
    this.last.set(key, t);
    if (this.last.size > 1000) this.prune(t);
    return true;
  }

  /** Seconds left before the key may be used again (0 when free). */
  remainingSeconds(key: string): number {
    const previous = this.last.get(key);
    if (previous === undefined) return 0;
    return Math.max(0, Math.ceil((this.ms - (this.now() - previous)) / 1000));
  }

  private prune(t: number) {
    for (const [key, at] of this.last) if (t - at >= this.ms) this.last.delete(key);
  }
}
