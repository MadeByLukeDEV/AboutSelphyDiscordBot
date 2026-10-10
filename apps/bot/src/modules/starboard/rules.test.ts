import { describe, expect, it } from "vitest";
import { isSingleEmoji, starboardSettingsSchema } from "@aboutselphy/shared/starboard";
import { buildStarMessage, countStars, decide, isStarEmoji, medal, safeImage } from "./rules";

describe("isSingleEmoji", () => {
  it("takes one emoji, with or without a variation selector or modifiers", () => {
    for (const ok of ["\u2B50", "\u2B50\uFE0F", "\u{1F525}", "\u2764\uFE0F", "\u{1F44D}\u{1F3FD}", "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"]) expect(isSingleEmoji(ok), ok).toBe(true);
  });

  it("refuses text, several emoji, custom emote syntax and nothing", () => {
    for (const bad of ["", "a", "star", "\u2B50\u2B50", "<:x:123456789012345678>", ":star:", "\u2B50 a"]) expect(isSingleEmoji(bad), bad).toBe(false);
  });
});

describe("settings", () => {
  const base = { enabled: true, channelId: "123456789012345678", emoji: "\u2B50", threshold: 3, allowSelf: false };
  it("needs a channel when on, a sane threshold and an emoji", () => {
    expect(starboardSettingsSchema.safeParse(base).success).toBe(true);
    expect(starboardSettingsSchema.safeParse({ ...base, channelId: "" }).success).toBe(false);
    expect(starboardSettingsSchema.safeParse({ ...base, enabled: false, channelId: "" }).success).toBe(true);
    expect(starboardSettingsSchema.safeParse({ ...base, threshold: 0 }).success).toBe(false);
    expect(starboardSettingsSchema.safeParse({ ...base, threshold: 26 }).success).toBe(false);
    expect(starboardSettingsSchema.safeParse({ ...base, emoji: "no" }).success).toBe(false);
  });
});

describe("isStarEmoji", () => {
  it("matches the unicode emoji regardless of the variation selector, never a server emote", () => {
    expect(isStarEmoji("\u2B50", { id: null, name: "\u2B50" })).toBe(true);
    expect(isStarEmoji("\u2B50\uFE0F", { id: null, name: "\u2B50" })).toBe(true);
    expect(isStarEmoji("\u2B50", { id: null, name: "\u{1F525}" })).toBe(false);
    expect(isStarEmoji("\u2B50", { id: "123456789012345678", name: "\u2B50" })).toBe(false);
    expect(isStarEmoji("\u2B50", { id: null, name: null })).toBe(false);
  });
});

describe("countStars", () => {
  it("counts each person once and skips bots and (by default) the author", () => {
    const bots = new Set(["b1"]);
    expect(countStars(["a", "b", "b", "b1", "author"], { authorId: "author", allowSelf: false, botIds: bots })).toBe(2);
    expect(countStars(["a", "author"], { authorId: "author", allowSelf: true })).toBe(2);
    expect(countStars([], { authorId: "author", allowSelf: false })).toBe(0);
  });
});

describe("decide", () => {
  it("posts at the threshold, keeps it updated, and removes it when it falls below", () => {
    expect(decide(3, 3, false)).toBe("post");
    expect(decide(5, 3, true)).toBe("update");
    expect(decide(2, 3, true)).toBe("remove");
    expect(decide(2, 3, false)).toBe("none");
  });
});

describe("medal", () => {
  it("grows with the count", () => {
    expect(medal(3)).toBe("\u2B50");
    expect(medal(10)).toBe("\u{1F4AB}");
    expect(medal(25)).toBe("\u{1F31F}");
  });
});

describe("safeImage", () => {
  it("only lets Discord CDN addresses through", () => {
    expect(safeImage("https://cdn.discordapp.com/attachments/1/2/a.png")).not.toBeNull();
    expect(safeImage("https://media.discordapp.net/attachments/1/2/a.png?x=1")).not.toBeNull();
    for (const bad of ["http://cdn.discordapp.com/a.png", "https://evil.example/a.png", "javascript:alert(1)", "https://cdn.discordapp.com.evil.example/a.png", "nope", null, undefined]) expect(safeImage(bad as string), String(bad)).toBeNull();
  });
});

describe("the re-post", () => {
  const view = (over = {}) => ({ emoji: "\u2B50", stars: 4, channelId: "222222222222222222", jumpUrl: "https://discord.com/channels/1/2/3", authorId: "111111111111111111", authorName: "Selphy", content: "hi **there** <@&999999999999999999>", imageUrl: null, attachmentCount: 0, at: new Date(0), ...over });
  const text = (m: ReturnType<typeof buildStarMessage>) => JSON.stringify(m.embeds[0]!.toJSON());

  it("shows the count and channel, escapes the text and pings nobody", () => {
    const m = buildStarMessage(view());
    expect(m.content).toBe("\u2B50 **4** | <#222222222222222222>");
    expect(text(m)).toContain("\\\\*\\\\*there\\\\*\\\\*");
    expect(text(m)).toContain("Jump to message");
    expect(m.allowedMentions).toEqual({ parse: [] });
  });

  it("works without text and mentions extra attachments", () => {
    const m = buildStarMessage(view({ content: "  ", attachmentCount: 3, imageUrl: "https://cdn.discordapp.com/a.png" }));
    expect(text(m)).toContain("3 attachments");
    expect(text(m)).toContain("cdn.discordapp.com/a.png");
  });
});
