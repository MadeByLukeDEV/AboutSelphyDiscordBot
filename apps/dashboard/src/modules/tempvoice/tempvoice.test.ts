import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOBBY_FORM,
  globalFormSchema,
  globalFromForm,
  globalSettingsSchema,
  globalToForm,
  isTemplateBlocked,
  lobbyFormSchema,
  lobbySchema,
  parseBlockedWords,
  type GlobalSettings,
  type LobbyInput,
} from "./schema";

const CHANNEL = "123456789012345678";

describe("parseBlockedWords", () => {
  it("splits on lines and commas, trims, collapses spaces", () => {
    expect(parseBlockedWords("one\n two ,three,  four   five \n")).toEqual(["one", "two", "three", "four five"]);
  });
  it("drops empty entries and case-insensitive duplicates, keeping the first spelling", () => {
    expect(parseBlockedWords("Foo\nfoo\n\n  \nFOO,bar")).toEqual(["Foo", "bar"]);
  });
  it("gives an empty list for nothing", () => {
    expect(parseBlockedWords("")).toEqual([]);
    expect(parseBlockedWords(" , \n ,")).toEqual([]);
  });
});

describe("globalSettingsSchema (the settings every lobby shares)", () => {
  const valid: GlobalSettings = { enabled: true, useDefaultBlocklist: true, blockedWords: ["badword"] };

  it("accepts a valid configuration", () => {
    expect(globalSettingsSchema.safeParse(valid).success).toBe(true);
  });
  it("bounds the blocked words", () => {
    expect(globalSettingsSchema.safeParse({ ...valid, blockedWords: Array.from({ length: 51 }, (_, i) => `w${i}`) }).success).toBe(false);
    expect(globalSettingsSchema.safeParse({ ...valid, blockedWords: ["x".repeat(51)] }).success).toBe(false);
    expect(globalSettingsSchema.safeParse({ ...valid, blockedWords: [""] }).success).toBe(false);
    expect(globalSettingsSchema.safeParse({ ...valid, blockedWords: ["a​b"] }).success).toBe(false);
  });
  it("rejects wrong types instead of coercing them", () => {
    expect(globalSettingsSchema.safeParse({ ...valid, enabled: "true" }).success).toBe(false);
    expect(globalSettingsSchema.safeParse({ enabled: true }).success).toBe(false);
  });
  it("round-trips the blocked words through the form's text block", () => {
    const form = globalToForm({ ...valid, blockedWords: ["one", "two words"] });
    expect(form.blockedWordsText).toBe("one\ntwo words");
    expect(globalFromForm(form).blockedWords).toEqual(["one", "two words"]);
    expect(globalFromForm({ ...form, blockedWordsText: "Spam, spam\n  Scam  " }).blockedWords).toEqual(["Spam", "Scam"]);
    expect(globalFormSchema.safeParse(form).success).toBe(true);
  });
});

describe("lobbySchema (one lobby, what the server action accepts)", () => {
  const valid: LobbyInput = {
    channelId: CHANNEL,
    categoryId: "",
    nameTemplate: "{user}'s room",
    defaultUserLimit: 0,
    allowVideoByDefault: true,
    allowSoundboardByDefault: true,
    enabled: true,
  };

  it("accepts a new lobby (no id) and an update (with an id)", () => {
    expect(lobbySchema.safeParse(valid).success).toBe(true);
    expect(lobbySchema.safeParse({ ...valid, id: "clx123" }).success).toBe(true);
  });

  it("needs a real channel ID: never empty, never free text", () => {
    for (const bad of ["", "abc", "123", "12345678901234567890123", "123456789012345678 "]) {
      expect(lobbySchema.safeParse({ ...valid, channelId: bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("allows an empty category (next to the lobby) but never a malformed one", () => {
    expect(lobbySchema.safeParse({ ...valid, categoryId: "" }).success).toBe(true);
    expect(lobbySchema.safeParse({ ...valid, categoryId: CHANNEL }).success).toBe(true);
    for (const bad of ["abc", "123", "x".repeat(30)]) expect(lobbySchema.safeParse({ ...valid, categoryId: bad }).success, bad).toBe(false);
  });

  it("bounds the member limit to 0-99 whole numbers", () => {
    for (const ok of [0, 1, 99]) expect(lobbySchema.safeParse({ ...valid, defaultUserLimit: ok }).success).toBe(true);
    for (const bad of [-1, 100, 1.5, Number.NaN]) expect(lobbySchema.safeParse({ ...valid, defaultUserLimit: bad }).success, String(bad)).toBe(false);
  });

  it("refuses blank, over-long and invisible-character name templates, and trims a good one", () => {
    for (const bad of ["", "   ", "x".repeat(101), "a​b", "a\u0007b"]) {
      expect(lobbySchema.safeParse({ ...valid, nameTemplate: bad }).success, JSON.stringify(bad)).toBe(false);
    }
    expect(lobbySchema.parse({ ...valid, nameTemplate: "  Hangout  " }).nameTemplate).toBe("Hangout");
  });

  it("refuses an oversized or empty lobby id", () => {
    expect(lobbySchema.safeParse({ ...valid, id: "" }).success).toBe(false);
    expect(lobbySchema.safeParse({ ...valid, id: "x".repeat(65) }).success).toBe(false);
  });

  it("rejects wrong types instead of coercing them", () => {
    expect(lobbySchema.safeParse({ ...valid, defaultUserLimit: "5" }).success).toBe(false);
    expect(lobbySchema.safeParse({ ...valid, enabled: "yes" }).success).toBe(false);
  });

  it("the form's defaults describe a valid lobby once a channel is picked", () => {
    expect(lobbyFormSchema.safeParse({ ...DEFAULT_LOBBY_FORM, channelId: CHANNEL }).success).toBe(true);
    // A new lobby with no channel passes the form schema: the dialog adds its own 'pick a channel' rule.
    expect(lobbyFormSchema.safeParse(DEFAULT_LOBBY_FORM).success).toBe(true);
  });
});

describe("isTemplateBlocked", () => {
  const policy = { blockedWords: ["secret"], useDefaultBlocklist: true };

  it("lets ordinary templates through, with {user} in them", () => {
    for (const template of ["{user}'s room", "Hangout", "Assassin's Creed night", "Class of {user}"]) {
      expect(isTemplateBlocked(template, policy), template).toBe(false);
    }
  });
  it("blocks a template that contains the admin's own word", () => {
    expect(isTemplateBlocked("Secret club {user}", policy)).toBe(true);
  });
  it("blocks a template hit by the built-in list, only while that is switched on", () => {
    expect(isTemplateBlocked("{user} is a sh1t", policy)).toBe(true);
    expect(isTemplateBlocked("{user} is a sh1t", { ...policy, useDefaultBlocklist: false })).toBe(false);
  });
  it("ignores {user} itself so a placeholder can't be read as part of a word", () => {
    expect(isTemplateBlocked("{user}", policy)).toBe(false);
  });
});
