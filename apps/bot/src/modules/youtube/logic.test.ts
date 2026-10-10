import { describe, expect, it } from "vitest";
import { decideUploads, MAX_ANNOUNCE_AGE_MS, parseIsoDuration, uploadsPlaylistId, type UploadCandidate } from "./logic";

const now = new Date("2026-10-13T12:00:00Z");
const video = (id: string, over: Partial<UploadCandidate> = {}): UploadCandidate => ({
  videoId: id,
  title: `Video ${id}`,
  publishedAt: new Date(now.getTime() - 3_600_000),
  durationSeconds: 600,
  privacy: "public",
  liveState: "none",
  ...over,
});
const base = { knownIds: new Set<string>(), firstRun: false, announceShorts: false, now };

describe("parseIsoDuration", () => {
  it("reads YouTube's durations", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT10M")).toBe(600);
    expect(parseIsoDuration("P1DT1H")).toBe(90_000);
    expect(parseIsoDuration("PT0S")).toBe(0);
  });

  it("refuses anything else", () => {
    for (const bad of ["", "P", "PT", "10:00", "1h", "PTS", "P1Y"]) expect(parseIsoDuration(bad), bad).toBeNull();
  });
});

describe("uploadsPlaylistId", () => {
  it("swaps the UC prefix for UU", () => {
    expect(uploadsPlaylistId("UCabcdefghijklmnopqrstuv")).toBe("UUabcdefghijklmnopqrstuv");
    expect(uploadsPlaylistId("@selphy")).toBeNull();
    expect(uploadsPlaylistId("UCshort")).toBeNull();
  });
});

describe("decideUploads", () => {
  it("announces a new public video", () => {
    expect(decideUploads({ ...base, videos: [video("a")] })).toEqual([{ videoId: "a", action: "announce", isShort: false }]);
  });

  it("skips what is already known", () => {
    expect(decideUploads({ ...base, knownIds: new Set(["a"]), videos: [video("a"), video("b")] }).map((d) => d.videoId)).toEqual(["b"]);
  });

  it("never announces on the first run, only remembers", () => {
    expect(decideUploads({ ...base, firstRun: true, videos: [video("a"), video("b")] }).every((d) => d.action === "remember")).toBe(true);
  });

  it("waits on private, unlisted, live and upcoming videos, and on a missing duration", () => {
    const list = [video("p", { privacy: "private" }), video("u", { privacy: "unlisted" }), video("l", { liveState: "live" }), video("s", { liveState: "upcoming" }), video("n", { durationSeconds: null })];
    expect(decideUploads({ ...base, videos: list }).map((d) => d.action)).toEqual(["wait", "wait", "wait", "wait", "wait"]);
  });

  it("handles Shorts by the setting", () => {
    const short = video("sh", { durationSeconds: 59 });
    expect(decideUploads({ ...base, videos: [short] })).toEqual([{ videoId: "sh", action: "remember", isShort: true }]);
    expect(decideUploads({ ...base, announceShorts: true, videos: [short] })).toEqual([{ videoId: "sh", action: "announce", isShort: true }]);
    expect(decideUploads({ ...base, announceShorts: false, videos: [video("edge", { durationSeconds: 180 })] })[0]).toMatchObject({ isShort: true });
    expect(decideUploads({ ...base, videos: [video("long", { durationSeconds: 181 })] })[0]).toMatchObject({ action: "announce", isShort: false });
  });

  it("does not announce an old video that only just became public", () => {
    const old = video("old", { publishedAt: new Date(now.getTime() - MAX_ANNOUNCE_AGE_MS - 1000) });
    expect(decideUploads({ ...base, videos: [old] })).toEqual([{ videoId: "old", action: "remember", isShort: false }]);
  });
});
