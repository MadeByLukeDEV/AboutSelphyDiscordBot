import { describe, expect, it } from "vitest";
import {
  fromFormValues,
  isTemplateBlocked,
  parseBlockedWords,
  settingsFormSchema,
  settingsSchema,
  toFormValues,
  type SettingsInput,
} from "./schema";

const LOBBY = "123456789012345678";

const valid: SettingsInput = {
  enabled: true,
  lobbyChannelId: LOBBY,
  categoryId: "",
  nameTemplate: "{user}'s room",
  defaultUserLimit: 0,
  allowVideoByDefault: true,
  allowSoundboardByDefault: true,
  blockedWords: ["badword"],
  useDefaultBlocklist: true,
};

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

describe("settingsSchema (what the server action accepts)", () => {
  it("accepts a valid configuration", () => {
    expect(settingsSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses to enable rooms without a lobby, with a code the action can report", () => {
    const result = settingsSchema.safeParse({ ...valid, lobbyChannelId: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.message === "needsLobby")).toBe(true);
  });

  it("allows a disabled configuration without a lobby", () => {
    expect(settingsSchema.safeParse({ ...valid, enabled: false, lobbyChannelId: "" }).success).toBe(true);
  });

  it("only takes Discord IDs for channels", () => {
    for (const bad of ["abc", "123", "12345678901234567890123", "123456789012345678 "]) {
      expect(settingsSchema.safeParse({ ...valid, lobbyChannelId: bad }).success, bad).toBe(false);
      expect(settingsSchema.safeParse({ ...valid, categoryId: bad }).success, bad).toBe(false);
    }
  });

  it("bounds the member limit to 0-99 whole numbers", () => {
    for (const ok of [0, 1, 99]) expect(settingsSchema.safeParse({ ...valid, defaultUserLimit: ok }).success).toBe(true);
    for (const bad of [-1, 100, 1.5, Number.NaN]) {
      expect(settingsSchema.safeParse({ ...valid, defaultUserLimit: bad }).success, String(bad)).toBe(false);
    }
  });

  it("refuses blank, over-long and invisible-character name templates", () => {
    for (const bad of ["", "   ", "x".repeat(101), "a​b", "a\u0007b"]) {
      expect(settingsSchema.safeParse({ ...valid, nameTemplate: bad }).success, JSON.stringify(bad)).toBe(false);
    }
    expect(settingsSchema.parse({ ...valid, nameTemplate: "  Hangout  " }).nameTemplate).toBe("Hangout");
  });

  it("bounds the blocked words", () => {
    expect(settingsSchema.safeParse({ ...valid, blockedWords: Array.from({ length: 51 }, (_, i) => `w${i}`) }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, blockedWords: ["x".repeat(51)] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, blockedWords: [""] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, blockedWords: ["a​b"] }).success).toBe(false);
  });

  it("rejects wrong types instead of coercing them", () => {
    expect(settingsSchema.safeParse({ ...valid, enabled: "true" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, defaultUserLimit: "5" }).success).toBe(false);
    expect(settingsSchema.safeParse({ enabled: true }).success).toBe(false);
  });
});

describe("isTemplateBlocked", () => {
  const base = { blockedWords: ["secret"], useDefaultBlocklist: true };

  it("lets ordinary templates through, with {user} in them", () => {
    for (const nameTemplate of ["{user}'s room", "Hangout", "Assassin's Creed night", "Class of {user}"]) {
      expect(isTemplateBlocked({ ...base, nameTemplate }), nameTemplate).toBe(false);
    }
  });
  it("blocks a template that contains the admin's own word", () => {
    expect(isTemplateBlocked({ ...base, nameTemplate: "Secret club {user}" })).toBe(true);
  });
  it("blocks a template hit by the built-in list, only while that is switched on", () => {
    expect(isTemplateBlocked({ ...base, nameTemplate: "{user} is a sh1t" })).toBe(true);
    expect(isTemplateBlocked({ ...base, useDefaultBlocklist: false, nameTemplate: "{user} is a sh1t" })).toBe(false);
  });
  it("ignores {user} itself so a placeholder can't be read as part of a word", () => {
    expect(isTemplateBlocked({ ...base, nameTemplate: "{user}" })).toBe(false);
  });
});

describe("the form <-> saved settings round trip", () => {
  it("turns blocked words into one block of text and back", () => {
    const form = toFormValues({ ...valid, blockedWords: ["one", "two words"] });
    expect(form.blockedWordsText).toBe("one\ntwo words");
    expect(fromFormValues(form).blockedWords).toEqual(["one", "two words"]);
  });

  it("normalises what a person typed", () => {
    const form = { ...toFormValues(valid), blockedWordsText: "Spam, spam\n  Scam  " };
    expect(fromFormValues(form).blockedWords).toEqual(["Spam", "Scam"]);
  });

  it("the form schema has the same lobby rule", () => {
    expect(settingsFormSchema.safeParse({ ...toFormValues(valid), lobbyChannelId: "" }).success).toBe(false);
    expect(settingsFormSchema.safeParse(toFormValues(valid)).success).toBe(true);
  });
});
