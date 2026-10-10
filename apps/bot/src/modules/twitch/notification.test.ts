import { describe, expect, it } from "vitest";
import { endedMessage, liveMessage, renderTemplate, thumbnail, type StreamView } from "./notification";

const stream: StreamView = {
  login: "selphy",
  displayName: "Selphy",
  title: "Chill **stream** with @everyone <@&123456789012345678>",
  game: "Just Chatting",
  startedAt: new Date("2026-10-12T10:00:00Z"),
  thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_selphy-{width}x{height}.jpg",
};

describe("renderTemplate", () => {
  it("fills the placeholders and neutralises what Twitch supplied", () => {
    const text = renderTemplate("{name} is live: {title} ({game}) {url}", stream);
    expect(text).toContain("Selphy is live:");
    expect(text).toContain("https://twitch.tv/selphy");
    // markdown and forged mentions in the title are escaped
    expect(text).toContain("\\*\\*stream\\*\\*");
    expect(text).toContain("\\<@&123456789012345678\\>");
    expect(text).not.toMatch(/(?<!\\)<@/);
  });

  it("falls back for an empty title and game, and leaves unknown placeholders alone", () => {
    const text = renderTemplate("{title} / {game} / {nope}", { ...stream, title: "", game: "" });
    expect(text).toBe("a new stream / something fun / {nope}");
  });
});

describe("thumbnail", () => {
  it("sizes and cache-busts Twitch's preview", () => {
    expect(thumbnail(stream.thumbnailUrl, 7)).toBe("https://static-cdn.jtvnw.net/previews-ttv/live_user_selphy-1280x720.jpg?t=7");
  });

  it("refuses anything that isn't Twitch's CDN, and an empty template", () => {
    expect(thumbnail("https://evil.example/{width}x{height}.jpg", 1)).toBeUndefined();
    expect(thumbnail("", 1)).toBeUndefined();
  });
});

describe("liveMessage", () => {
  it("pings only the configured role", () => {
    const m = liveMessage(stream, "{name} is live", "999999999999999999");
    expect(m.content.startsWith("<@&999999999999999999> ")).toBe(true);
    expect(m.allowedMentions).toEqual({ parse: [], roles: ["999999999999999999"] });
  });

  it("pings nobody without a role, even if the title contains mentions", () => {
    const m = liveMessage(stream, "{title}", null);
    expect(m.allowedMentions).toEqual({ parse: [] });
    expect(m.content).not.toMatch(/(?<!\\)<@/);
  });

  it("applies the colour and leaves out the picture and the game when asked", () => {
    const m = liveMessage(stream, "{name}", null, { color: 0xff0000, showThumbnail: false, showGame: false });
    const json = m.embeds[0]!.toJSON();
    expect(json.color).toBe(0xff0000);
    expect(json.image).toBeUndefined();
    expect(json.fields).toBeUndefined();
  });

  it("fills {login} too", () => {
    expect(renderTemplate("{login}", stream)).toBe("selphy");
  });

  it("stays inside Discord's limits", () => {
    const m = liveMessage({ ...stream, title: "x".repeat(500), game: "y".repeat(500) }, "z".repeat(3000), null);
    expect(m.content.length).toBeLessThanOrEqual(2000);
    const json = m.embeds[0]!.toJSON();
    expect(json.title!.length).toBeLessThanOrEqual(256);
    expect(json.fields![0]!.value.length).toBeLessThanOrEqual(256);
  });
});

describe("endedMessage", () => {
  it("has no ping, no preview image and says when it ended", () => {
    const m = endedMessage(stream, new Date("2026-10-12T12:00:00Z"));
    expect(m.content).toBe("");
    expect(m.allowedMentions).toEqual({ parse: [] });
    const json = m.embeds[0]!.toJSON();
    expect(json.image).toBeUndefined();
    expect(json.description).toContain("<t:");
  });
});
