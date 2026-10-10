import { BUILT_IN_PATTERN_COUNT, findBlockedWord, findProfanity, normalizeForMatch } from "@aboutselphy/shared";
import { describe, expect, it } from "vitest";

// Slurs are assembled from pieces so they aren't spelled out in this file.
const join = (...parts: string[]) => parts.join("");
const N_WORD = join("ni", "gg", "er");
const F_SLUR = join("fa", "gg", "ot");

describe("findProfanity: what it catches", () => {
  it.each([
    "fuck", "FUCK", "Fucker", "fucking room", "motherfucker", "shit", "shitty", "bullshit", "bitch", "bitches",
    "asshole", "dumbass", "cunt", "whore", "slut", "wanker", "retarded", "Scheiße", "scheisse", "Arschloch",
    "arschlöcher", "Hurensohn", "wichser", "Fotze", "schlampe", "ficken", "Spasti", "missgeburt", "sieg heil",
  ])("blocks %s", (text) => {
    expect(findProfanity(text), text).not.toBeNull();
  });

  it("blocks slurs", () => {
    for (const text of [N_WORD, `${N_WORD}s`, F_SLUR, join("ni", "gg", "a"), join("ki", "ke"), join("tran", "ny")]) {
      expect(findProfanity(text), text).not.toBeNull();
    }
  });

  it("blocks them inside a longer name, next to digits and punctuation", () => {
    for (const text of ["Selphy's fuck room", "shit123", "xX_fuck_Xx", "the bitch's den", "fuck-off", "(shit)", "bullshit!!!"]) {
      expect(findProfanity(text), text).not.toBeNull();
    }
  });

  it("sees through look-alike characters and bleeps", () => {
    for (const text of ["sh1t", "f*ck", "sh!t", "b1tch", "a$$hole", "fvck", "5hit", "fck", "fuk"]) {
      expect(findProfanity(text), text).not.toBeNull();
    }
  });

  it("sees through stretched letters", () => {
    for (const text of ["fuuuuck", "shiiiit", "biiiitch", "fuuuck you"]) {
      expect(findProfanity(text), text).not.toBeNull();
    }
  });

  it("sees through spaced-out and dotted letters", () => {
    for (const text of ["f u c k", "f.u.c.k", "s h i t", "b-i-t-c-h", "you are a s.h.i.t"]) {
      expect(findProfanity(text), text).not.toBeNull();
    }
  });

  it("sees through invisible characters and look-alike letters from other alphabets", () => {
    expect(findProfanity("fu​ck")).not.toBeNull();
    expect(findProfanity("fu­ck")).not.toBeNull();
    expect(findProfanity("ѕhit")).not.toBeNull(); // Cyrillic ѕ
    expect(findProfanity("fuсk")).not.toBeNull(); // Cyrillic с
    expect(findProfanity("ｆｕｃｋ")).not.toBeNull(); // fullwidth
    expect(findProfanity("𝐟𝐮𝐜𝐤")).not.toBeNull(); // mathematical bold
  });

  it("handles German spelling: ß, umlauts and ae/oe-free forms", () => {
    expect(findProfanity("SCHEISSE")).not.toBeNull();
    expect(findProfanity("Scheiß egal")).not.toBeNull();
    expect(findProfanity("Arschlöcher")).not.toBeNull();
  });
});

describe("findProfanity: what it must leave alone", () => {
  it.each([
    // The Scunthorpe problem: bad letters inside innocent words
    "assassin", "Assassin's Creed", "class", "classic", "grass", "bass", "mass effect", "passion", "assistant", "analysis",
    "cockpit", "cocktail", "peacock", "Hancock", "Scunthorpe", "Essex", "Sussex", "shiitake", "Shitake mushrooms", "Niger",
    "Dickens", "Fickle", "Marsch", "title", "bitcoin", "retardant", "fire retardant", "Kikeriki", "fagot",
    // Everyday and gaming room names
    "Selphy's room", "Movie night", "Chill corner", "Hell Let Loose", "Damn good time", "Sea of Thieves", "Genshin Impact",
    "Study together", "Game night 🎮", "Hangout 123", "Rocket League", "Fortnite squad", "Café", "Übung", "Straße",
    "Ihre Lobby", "Nutzer", "Kuchen", "Schule", "Fotografie",
  ])("leaves %j alone", (text) => {
    expect(findProfanity(text), text).toBeNull();
  });

  it("leaves empty and symbol-only text alone", () => {
    for (const text of ["", "   ", "!!!", "1234", "🎮🎮🎮", "a b c d e f g"]) expect(findProfanity(text), JSON.stringify(text)).toBeNull();
  });
});

describe("findProfanity: robustness", () => {
  it("stays fast on hostile input (no catastrophic backtracking)", () => {
    const hostile = [
      "f".repeat(5000),
      "fu".repeat(2500),
      `${"s".repeat(4000)}!`,
      "a ".repeat(2500),
      "f.u.c.".repeat(800),
      "​".repeat(5000),
      "ni".repeat(2500),
    ];
    const start = performance.now();
    for (const text of hostile) findProfanity(text);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it("has a sensible number of built-in patterns", () => {
    expect(BUILT_IN_PATTERN_COUNT).toBeGreaterThan(30);
  });
});

describe("normalizeForMatch", () => {
  it("folds case, accents, ß, fullwidth letters and invisible characters", () => {
    expect(normalizeForMatch("  Scheiß   ÄÖÜ é ")).toBe("scheiss aou e");
    expect(normalizeForMatch("ＡＢＣ")).toBe("abc");
    expect(normalizeForMatch("a​b­c")).toBe("abc");
  });
});

describe("findBlockedWord (the admin's own list)", () => {
  it("matches case-insensitively as a plain substring, through normalisation", () => {
    expect(findBlockedWord("My BADWORD room", ["badword"])).toBe("badword");
    expect(findBlockedWord("bad​word", ["badword"])).toBe("badword");
    expect(findBlockedWord("fine room", ["badword"])).toBeNull();
  });
  it("treats entries as literal text, never as a pattern", () => {
    expect(findBlockedWord("a.c", [".*"])).toBeNull();
    expect(findBlockedWord("abc", ["a.c"])).toBeNull();
    expect(findBlockedWord("a.c", ["a.c"])).toBe("a.c");
  });
  it("ignores blank entries", () => {
    expect(findBlockedWord("anything", ["", "   "])).toBeNull();
  });
});
