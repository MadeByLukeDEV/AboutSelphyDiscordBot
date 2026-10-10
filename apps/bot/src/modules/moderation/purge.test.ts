import { describe, expect, it } from "vitest";
import { BULK_DELETE_MAX_AGE_MS, selectForPurge, type PurgeCandidate } from "./purge";

const now = 1_000_000_000_000;
const msg = (id: string, over: Partial<PurgeCandidate> = {}): PurgeCandidate => ({
  id,
  authorId: "u1",
  authorIsBot: false,
  createdAt: now - 1000,
  pinned: false,
  ...over,
});

describe("selectForPurge", () => {
  it("takes the newest messages up to the count", () => {
    expect(selectForPurge([msg("1"), msg("2"), msg("3")], { count: 2, now })).toEqual(["1", "2"]);
  });

  it("never deletes pinned messages", () => {
    expect(selectForPurge([msg("1", { pinned: true }), msg("2")], { count: 5, now })).toEqual(["2"]);
  });

  it("skips messages too old for a bulk delete", () => {
    const old = msg("old", { createdAt: now - BULK_DELETE_MAX_AGE_MS - 1 });
    expect(selectForPurge([msg("1"), old, msg("2")], { count: 5, now })).toEqual(["1", "2"]);
  });

  it("filters by member and counts only matches toward the limit", () => {
    const list = [msg("1", { authorId: "u2" }), msg("2"), msg("3", { authorId: "u2" }), msg("4"), msg("5")];
    expect(selectForPurge(list, { count: 2, userId: "u1", now })).toEqual(["2", "4"]);
  });

  it("can be limited to bots", () => {
    const list = [msg("1"), msg("2", { authorIsBot: true }), msg("3", { authorIsBot: true })];
    expect(selectForPurge(list, { count: 5, botsOnly: true, now })).toEqual(["2", "3"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(selectForPurge([msg("1")], { count: 5, userId: "nobody", now })).toEqual([]);
  });
});
