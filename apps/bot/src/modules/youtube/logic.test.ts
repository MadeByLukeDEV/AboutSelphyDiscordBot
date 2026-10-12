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

describe("premieres", () => {
  const upcoming = (id: string, hoursAhead: number, over: Partial<UploadCandidate> = {}) =>
    video(id, { liveState: "upcoming", durationSeconds: 0, scheduledStart: new Date(now.getTime() + hoursAhead * 3_600_000), ...over });
  const premiere = { ...base, announcePremieres: true };

  it("announces an upcoming premiere once, ahead of time", () => {
    expect(decideUploads({ ...premiere, videos: [upcoming("p", 5)] })).toEqual([{ videoId: "p", action: "premiere" }]);
  });
  it("waits when the switch is off, and never announces on the first run", () => {
    expect(decideUploads({ ...base, announcePremieres: false, videos: [upcoming("p", 5)] })).toEqual([{ videoId: "p", action: "wait" }]);
    expect(decideUploads({ ...premiere, firstRun: true, videos: [upcoming("p", 5)] })).toEqual([{ videoId: "p", action: "wait" }]);
  });
  it("waits for a premiere that is too far away, has no start time, or is not public", () => {
    expect(decideUploads({ ...premiere, videos: [upcoming("far", 24 * 30)] })[0]).toMatchObject({ action: "wait" });
    expect(decideUploads({ ...premiere, videos: [upcoming("none", 5, { scheduledStart: null })] })[0]).toMatchObject({ action: "wait" });
    expect(decideUploads({ ...premiere, videos: [upcoming("priv", 5, { privacy: "private" })] })[0]).toMatchObject({ action: "wait" });
  });
  it("still announces one that started up to an hour ago, but not a long gone one", () => {
    expect(decideUploads({ ...premiere, videos: [upcoming("late", -0.5)] })[0]).toMatchObject({ action: "premiere" });
    expect(decideUploads({ ...premiere, videos: [upcoming("gone", -3)] })[0]).toMatchObject({ action: "wait" });
  });
  it("does not announce a premiere it already knows", () => {
    expect(decideUploads({ ...premiere, knownIds: new Set(["p"]), videos: [upcoming("p", 5)] })).toEqual([]);
  });
});
