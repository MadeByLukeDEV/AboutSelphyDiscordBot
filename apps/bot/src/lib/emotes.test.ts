import { beforeEach, describe, expect, it } from "vitest";
import { escapeText } from "./escape";
import { mapEmotes, setEmotes, withEmotes } from "./emotes";

const wave = { id: "111111111111111111", name: "wave", animated: false };
const party = { id: "222222222222222222", name: "party_blob", animated: true };

beforeEach(() => setEmotes([wave, party]));

describe("withEmotes", () => {
  it("turns a shortcode into the real emote, animated ones too", () => {
    expect(withEmotes("hi :wave: and :party_blob:")).toBe("hi <:wave:111111111111111111> and <a:party_blob:222222222222222222>");
  });
  it("ignores case in a shortcode", () => {
    expect(withEmotes(":WAVE:")).toBe("<:wave:111111111111111111>");
  });
  it("keeps markup of this server's emotes, and rebuilds it with the current name", () => {
    expect(withEmotes("<:oldname:111111111111111111>")).toBe("<:wave:111111111111111111>");
  });
  it("leaves unknown shortcodes, other servers' markup and made-up ids as plain text", () => {
    expect(withEmotes(":nope: <:other:999999999999999999> 12:30:45")).toBe(":nope: <:other:999999999999999999> 12:30:45");
  });
  it("does nothing without any emote (before the server's emotes are loaded)", () => {
    setEmotes([]);
    expect(withEmotes(":wave:")).toBe(":wave:");
  });
  it("leaves text without colons alone", () => {
    expect(withEmotes("**bold** and <@123456789012345678>")).toBe("**bold** and <@123456789012345678>");
  });
});

describe("escapeText with emotes", () => {
  it("escapes everything around an emote but keeps the emote working", () => {
    expect(escapeText("*hey* :wave: <@123456789012345678>")).toBe("\\*hey\\* <:wave:111111111111111111> \\<@123456789012345678\\>");
  });
  it("an emote name with underscores isn't mangled by the escaping", () => {
    expect(escapeText(":party_blob: a_b")).toBe("<a:party_blob:222222222222222222> a\\_b");
  });
  it("still collapses whitespace and trims", () => {
    expect(escapeText("  a   :wave:   b  ")).toBe("a <:wave:111111111111111111> b");
  });
  it("a made-up emote id can't be forged through a member's text", () => {
    expect(escapeText("<:wave:999999999999999999>")).toBe("\\<:wave:999999999999999999\\>");
  });
  it("behaves as before when no emotes are loaded", () => {
    setEmotes([]);
    expect(escapeText(" *x* :wave: ")).toBe("\\*x\\* :wave:");
  });
});

describe("mapEmotes", () => {
  it("passes the surrounding text through the given function only", () => {
    expect(mapEmotes("a :wave: b", (s) => s.toUpperCase())).toBe("A <:wave:111111111111111111> B");
  });
});
