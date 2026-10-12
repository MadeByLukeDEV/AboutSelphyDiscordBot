import { describe, expect, it } from "vitest";
import { premiereMessage, renderTemplate, safeThumbnail, videoMessage, type VideoView } from "./message";

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

describe("watch button and premieres", () => {
  const upcoming: VideoView = { ...video, scheduledStart: new Date("2026-10-20T18:00:00Z") };

  it("adds a link button only when asked", () => {
    expect(videoMessage(video, "{title}", null, 1).components).toHaveLength(0);
    const withButton = videoMessage(video, "{title}", null, 1, true);
    expect(withButton.components).toHaveLength(1);
    expect(JSON.stringify(withButton.components[0]!.toJSON())).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
  it("fills {time} with a relative Discord time, and leaves it empty without a start", () => {
    expect(renderTemplate("Starts {time}", upcoming)).toBe(`Starts <t:${Math.floor(upcoming.scheduledStart!.getTime() / 1000)}:R>`);
    expect(renderTemplate("Starts {time}.", video)).toBe("Starts .");
  });
  it("puts the start on the premiere embed and still cannot ping anyone but the role", () => {
    const message = premiereMessage(upcoming, "Premiere {time}: {title}", "123456789012345678", 1, true);
    expect(message.embeds[0]!.toJSON().description).toContain("<t:");
    expect(message.allowedMentions).toEqual({ parse: [], roles: ["123456789012345678"] });
  });
});
