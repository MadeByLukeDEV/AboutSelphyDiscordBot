import { describe, expect, it } from "vitest";
import { renderTemplate, safeThumbnail, videoMessage, type VideoView } from "./message";

const video: VideoView = {
  videoId: "dQw4w9WgXcQ",
  title: "Big **news** <@&123456789012345678>",
  channelTitle: "Selphy",
  publishedAt: new Date("2026-10-13T10:00:00Z"),
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
};

describe("renderTemplate", () => {
  it("fills the placeholders and neutralises what YouTube supplied", () => {
    const text = renderTemplate("{channel}: {title} {url}", video);
    expect(text).toContain("Selphy:");
    expect(text).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(text).toContain("\\*\\*news\\*\\*");
    expect(text).not.toMatch(/(?<!\\)<@/);
  });
});

describe("safeThumbnail", () => {
  it("only accepts YouTube's image host", () => {
    expect(safeThumbnail(video.thumbnailUrl)).toBe(video.thumbnailUrl);
    expect(safeThumbnail("https://evil.example/a.jpg")).toBeUndefined();
    expect(safeThumbnail("http://i.ytimg.com/a.jpg")).toBeUndefined();
    expect(safeThumbnail(null)).toBeUndefined();
  });
});

describe("videoMessage", () => {
  it("pings only the configured role", () => {
    const m = videoMessage(video, "{title}", "999999999999999999", 0xff0000);
    expect(m.content.startsWith("<@&999999999999999999> ")).toBe(true);
    expect(m.allowedMentions).toEqual({ parse: [], roles: ["999999999999999999"] });
    expect(videoMessage(video, "{title}", null, 0xff0000).allowedMentions).toEqual({ parse: [] });
  });

  it("stays inside Discord's limits", () => {
    const m = videoMessage({ ...video, title: "x".repeat(500) }, "y".repeat(3000), null, 0);
    expect(m.content.length).toBeLessThanOrEqual(2000);
    expect(m.embeds[0]!.toJSON().title!.length).toBeLessThanOrEqual(256);
  });
});
