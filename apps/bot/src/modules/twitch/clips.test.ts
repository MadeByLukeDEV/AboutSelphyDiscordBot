import { describe, expect, it } from "vitest";
import { clipMessage, isTwitchClipUrl, planClips } from "./clips";
import type { TwitchClip } from "./helix";

const now = new Date("2026-11-07T12:00:00Z");
const clip = (id: string, minutesAgo: number, over: Partial<TwitchClip> = {}): TwitchClip => ({
  id,
  url: `https://www.twitch.tv/streamer/clip/${id}`,
  title: `Clip ${id}`,
  creatorName: "Fan",
  createdAt: new Date(now.getTime() - minutesAgo * 60_000),
  viewCount: 0,
  ...over,
});

describe("planClips", () => {
  it("the first check remembers everything and posts nothing", () => {
    const plan = planClips([clip("a", 5), clip("b", 600)], new Set(), null, now);
    expect(plan.post).toEqual([]);
    expect(plan.remember).toEqual(["a", "b"]);
  });
  it("posts unseen clips made since the last check, oldest first", () => {
    const checked = new Date(now.getTime() - 5 * 60_000);
    const plan = planClips([clip("new2", 1), clip("new1", 3), clip("old", 120)], new Set(), checked, now);
    expect(plan.post.map((c) => c.id)).toEqual(["new1", "new2"]);
    expect(plan.remember).toEqual(["old"]);
  });
  it("waits for a clip to reach the view limit and posts it later", () => {
    const checked = new Date(now.getTime() - 5 * 60_000);
    const young = clip("young", 2, { viewCount: 1 });
    const popular = clip("popular", 3, { viewCount: 9 });
    const first = planClips([young, popular], new Set(), checked, now, 3, 5);
    expect(first.post.map((c) => c.id)).toEqual(["popular"]);
    expect(first.remember).toEqual([]);
    const later = planClips([{ ...young, viewCount: 6 }], new Set(["popular"]), checked, now, 3, 5);
    expect(later.post.map((c) => c.id)).toEqual(["young"]);
  });
  it("drops a clip that never got enough views once it is too old to post", () => {
    const checked = new Date(now.getTime() - 5 * 60_000);
    const plan = planClips([clip("stale", 600, { viewCount: 1 })], new Set(), checked, now, 3, 5);
    expect(plan.post).toEqual([]);
    expect(plan.remember).toEqual(["stale"]);
  });
  it("never posts a clip it has seen", () => {
    const checked = new Date(now.getTime() - 5 * 60_000);
    expect(planClips([clip("a", 1)], new Set(["a"]), checked, now).post).toEqual([]);
  });
  it("posts at most the limit and remembers the rest silently", () => {
    const checked = new Date(now.getTime() - 20 * 60_000);
    const plan = planClips([1, 2, 3, 4, 5].map((n) => clip(`c${n}`, n)), new Set(), checked, now, 3);
    expect(plan.post).toHaveLength(3);
    expect(plan.remember).toHaveLength(2);
  });
  it("ignores clips older than six hours even after a long gap", () => {
    const checked = new Date(now.getTime() - 48 * 3_600_000);
    const plan = planClips([clip("stale", 7 * 60), clip("ok", 30)], new Set(), checked, now);
    expect(plan.post.map((c) => c.id)).toEqual(["ok"]);
    expect(plan.remember).toEqual(["stale"]);
  });
});

describe("clip messages", () => {
  it("only links Twitch pages", () => {
    expect(isTwitchClipUrl("https://clips.twitch.tv/FunnyClipName-abc123")).toBe(true);
    expect(isTwitchClipUrl("https://www.twitch.tv/streamer/clip/Name-abc")).toBe(true);
    expect(isTwitchClipUrl("https://evil.example/twitch.tv/x")).toBe(false);
    expect(isTwitchClipUrl("http://clips.twitch.tv/x")).toBe(false);
    expect(isTwitchClipUrl("https://clips.twitch.tv/x\nhttps://evil.example")).toBe(false);
  });
  it("escapes the title and names and refuses a foreign address", () => {
    const text = clipMessage(clip("a", 1, { title: "@everyone **hi**", creatorName: "_x_" }), "Name");
    expect(text).not.toContain("@everyone **hi**");
    expect(text).toContain("https://www.twitch.tv/streamer/clip/a");
    expect(clipMessage(clip("a", 1, { url: "https://evil.example/a" }), "Name")).toBeNull();
  });
});
