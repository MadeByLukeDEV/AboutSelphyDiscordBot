/**
 * Runs async work one at a time per key; different keys run in parallel.
 *
 * Voice events for the same room arrive in quick bursts (someone leaves, someone
 * joins, the channel is being deleted...). Handling them concurrently would let
 * "delete the empty room" race with "someone just joined". A failed task never
 * blocks the ones queued behind it.
 */
export class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task); // run after the previous one, whether it worked or not
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);
    // Drop the entry once this task is the last one, so the map doesn't grow forever.
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }

  /** Number of keys with work in flight or queued (for tests). */
  get size(): number {
    return this.tails.size;
  }
}
