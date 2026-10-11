import { describe, expect, it } from "vitest";
import { addedBeforeStart, LATE_ANNOUNCE_WINDOW_MS, planReconcile } from "./reconcile";

const now = new Date("2026-10-12T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const base = { knownStreamIds: new Set<string>(), channelsWithHistory: new Set<string>(), open: [], now };

describe("planReconcile", () => {
  it("never announces a channel it has not seen before (first run), only remembers it", () => {
    const plan = planReconcile({ ...base, live: [{ id: "1", userId: "42", startedAt: ago(60_000) }] });
    expect(plan.announce).toEqual([]);
    expect(plan.baseline).toHaveLength(1);
  });

  it("announces a recent stream of a known channel that the bot missed", () => {
    const plan = planReconcile({
      ...base,
      channelsWithHistory: new Set(["42"]),
      live: [{ id: "1", userId: "42", startedAt: ago(5 * 60_000) }],
    });
    expect(plan.announce.map((s) => s.id)).toEqual(["1"]);
    expect(plan.baseline).toEqual([]);
  });

  it("does not announce a stream that has been running for hours", () => {
    const plan = planReconcile({
      ...base,
      channelsWithHistory: new Set(["42"]),
      live: [{ id: "1", userId: "42", startedAt: ago(LATE_ANNOUNCE_WINDOW_MS + 1000) }],
    });
    expect(plan.announce).toEqual([]);
    expect(plan.baseline).toHaveLength(1);
  });

  it("leaves a stream alone that already has a row", () => {
    const plan = planReconcile({
      ...base,
      knownStreamIds: new Set(["1"]),
      channelsWithHistory: new Set(["42"]),
      live: [{ id: "1", userId: "42", startedAt: ago(1000) }],
      open: [{ id: "row1", twitchStreamId: "1", twitchUserId: "42" }],
    });
    expect(plan).toEqual({ announce: [], baseline: [], close: [] });
  });

  it("closes open rows whose stream is gone, including a stream replaced by a new one", () => {
    const plan = planReconcile({
      ...base,
      knownStreamIds: new Set(["1"]),
      channelsWithHistory: new Set(["42"]),
      live: [{ id: "2", userId: "42", startedAt: ago(1000) }],
      open: [{ id: "row1", twitchStreamId: "1", twitchUserId: "42" }],
    });
    expect(plan.close.map((r) => r.id)).toEqual(["row1"]);
    expect(plan.announce.map((s) => s.id)).toEqual(["2"]);
  });
});

describe("addedBeforeStart", () => {
  it("is true for a stream that began after the channel was added, false for one already live then", () => {
    expect(addedBeforeStart(new Date("2026-10-01T10:00:00Z"), new Date("2026-10-01T12:00:00Z"))).toBe(true);
    expect(addedBeforeStart(new Date("2026-10-01T10:00:00Z"), new Date("2026-10-01T09:00:00Z"))).toBe(false);
  });
});
