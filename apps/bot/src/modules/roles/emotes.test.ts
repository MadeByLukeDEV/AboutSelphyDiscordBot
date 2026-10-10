import { describe, expect, it } from "vitest";
import { customEmojiUrl, isPanelEmoji, parseEmoji, rolePanelInput } from "@aboutselphy/shared/role-panel";
import { buildPanelMessage, emojiMatches, toComponentEmoji, toReactionIdentifier, type PanelView } from "./panel";

describe("parseEmoji", () => {
  it("reads unicode emoji and the server's own emotes", () => {
    expect(parseEmoji("🎮")).toEqual({ kind: "unicode", name: "🎮" });
    expect(parseEmoji("<:pog:123456789012345678>")).toEqual({ kind: "custom", id: "123456789012345678", name: "pog", animated: false });
    expect(parseEmoji("<a:dance:123456789012345678>")).toEqual({ kind: "custom", id: "123456789012345678", name: "dance", animated: true });
  });

  it("refuses everything else", () => {
    for (const bad of ["", "abc", ":pog:", "<:pog:12>", "<:p:123456789012345678>", "<:po g:123456789012345678>", "<:pog:123456789012345678", "https://x.test/a.png"]) {
      expect(parseEmoji(bad), bad).toBeNull();
    }
  });

  it("isPanelEmoji allows empty, unicode and emotes", () => {
    expect(isPanelEmoji("")).toBe(true);
    expect(isPanelEmoji("🎮")).toBe(true);
    expect(isPanelEmoji("<:pog:123456789012345678>")).toBe(true);
    expect(isPanelEmoji("<script>")).toBe(false);
  });

  it("builds the CDN address of an emote", () => {
    expect(customEmojiUrl("123456789012345678", false, 32)).toBe("https://cdn.discordapp.com/emojis/123456789012345678.png?size=32");
    expect(customEmojiUrl("123456789012345678", true)).toContain(".gif");
  });
});

describe("emoji for Discord", () => {
  it("gives components and reactions the form they need", () => {
    expect(toComponentEmoji("🎮")).toBe("🎮");
    expect(toComponentEmoji("<a:dance:123456789012345678>")).toEqual({ id: "123456789012345678", name: "dance", animated: true });
    expect(toComponentEmoji("nonsense")).toBeUndefined();
    expect(toReactionIdentifier("🎮")).toBe("🎮");
    expect(toReactionIdentifier("<:pog:123456789012345678>")).toBe("pog:123456789012345678");
  });

  it("matches a reaction to a stored emoji by id for emotes and by character for unicode", () => {
    expect(emojiMatches("<:pog:123456789012345678>", { id: "123456789012345678", name: "renamed" })).toBe(true);
    expect(emojiMatches("<:pog:123456789012345678>", { id: "999999999999999999", name: "pog" })).toBe(false);
    expect(emojiMatches("🎮", { id: null, name: "🎮" })).toBe(true);
    expect(emojiMatches("🎮", { id: "123456789012345678", name: "🎮" })).toBe(false);
    expect(emojiMatches("🎮", { id: null, name: "🎯" })).toBe(false);
    expect(emojiMatches("", { id: null, name: "🎮" })).toBe(false);
  });
});

describe("a reactions panel", () => {
  const panel: PanelView = {
    id: "cm1abc2def3ghi",
    title: "Pick",
    description: "Games",
    color: 0,
    imageUrl: "",
    style: "reactions",
    exclusive: false,
    roles: [
      { roleId: "111111111111111111", label: "Gamer", emoji: "🎮", description: "" },
      { roleId: "222222222222222222", label: "Pog", emoji: "<:pog:123456789012345678>", description: "" },
    ],
  };

  it("has no buttons and lists the emoji in the message", () => {
    const m = buildPanelMessage(panel);
    expect(m.components).toHaveLength(0);
    const text = m.embeds[0]!.toJSON().description!;
    expect(text).toContain("🎮 Gamer");
    expect(text).toContain("<:pog:123456789012345678> Pog");
    expect(m.allowedMentions).toEqual({ parse: [] });
  });

  it("uses a server emote on a button too", () => {
    const m = buildPanelMessage({ ...panel, style: "buttons" });
    const json = m.components[0]!.toJSON().components as Array<{ emoji?: { id?: string; name?: string } }>;
    expect(json[1]!.emoji?.id).toBe("123456789012345678");
    expect(json[0]!.emoji?.name).toBe("🎮");
  });
});

describe("rolePanelInput for reactions", () => {
  const role = (i: number, emoji: string) => ({ roleId: `1000000000000000${String(i).padStart(2, "0")}`, label: `R${i}`, emoji, description: "" });
  const base = { channelId: "123456789012345678", title: "T", description: "", color: 0, imageUrl: "", style: "reactions" as const, exclusive: false, publish: false };
  const parse = (roles: unknown[]) => rolePanelInput.safeParse({ ...base, roles });

  it("needs a different emoji on every role", () => {
    expect(parse([role(1, "🎮"), role(2, "<:pog:123456789012345678>")]).success).toBe(true);
    expect(parse([role(1, "🎮"), role(2, "")]).success).toBe(false);
    expect(parse([role(1, "🎮"), role(2, "🎮")]).success).toBe(false);
  });

  it("allows at most 20 reactions", () => {
    const emojis = ["🎮", "🎯", "🎲", "🎨", "🎧", "🎤", "🎬", "🎭", "🎸", "🎹", "🎺", "🎻", "🏀", "🏈", "⚽", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸"];
    expect(parse(emojis.slice(0, 20).map((e, i) => role(i, e))).success).toBe(true);
    expect(parse(emojis.slice(0, 21).map((e, i) => role(i, e))).success).toBe(false);
  });

  it("still takes server emotes on buttons without limits on repeats of none", () => {
    expect(rolePanelInput.safeParse({ ...base, style: "buttons", roles: [role(1, "<:pog:123456789012345678>"), role(2, "")] }).success).toBe(true);
  });
});
