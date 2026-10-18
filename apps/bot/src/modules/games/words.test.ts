import { describe, expect, it } from "vitest";
import { compareGuess, gallows, guessLetter, guessWord, HANGMAN_LIVES, isScrambleAnswer, isSolved, maskedWord, newHangman, parseHangmanGuess, parseNumberGuess, pickWord, scramble, WORDS } from "./words";

describe("the word list", () => {
  it("is plain lowercase letters, a sensible length, no duplicates", () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const w of WORDS) {
      expect(w).toMatch(/^[a-z]{4,12}$/);
    }
    expect(WORDS.length).toBeGreaterThanOrEqual(100);
  });
  it("avoids recent words until all are used", () => {
    const avoid = new Set<string>(WORDS.filter((w) => w !== "anchor"));
    expect(pickWord(() => 0.5, avoid)).toBe("anchor");
    expect(WORDS).toContain(pickWord(() => 0.5, new Set(WORDS)));
  });
});

describe("hangman", () => {
  it("fills in letters and wins on the last one", () => {
    const h = newHangman("cat");
    expect(maskedWord(h)).toBe("\\_ \\_ \\_");
    expect(guessLetter(h, "c")).toBe("hit");
    expect(guessLetter(h, "c")).toBe("repeat");
    expect(maskedWord(h)).toBe("C \\_ \\_");
    expect(guessLetter(h, "a")).toBe("hit");
    expect(guessLetter(h, "t")).toBe("won");
    expect(isSolved(h)).toBe(true);
  });
  it("loses a life per miss and loses after seven", () => {
    const h = newHangman("cat");
    const wrong = "bdefghi".split("");
    for (const [i, l] of wrong.entries()) expect(guessLetter(h, l)).toBe(i === 6 ? "lost" : "miss");
    expect(h.lives).toBe(0);
    expect(guessLetter(h, "b")).toBe("repeat");
  });
  it("a whole-word guess wins or costs a life", () => {
    const a = newHangman("cat");
    expect(guessWord(a, "cat")).toBe("won");
    expect(isSolved(a)).toBe(true);
    const b = newHangman("cat");
    expect(guessWord(b, "dog")).toBe("miss");
    expect(b.lives).toBe(HANGMAN_LIVES - 1);
  });
  it("only reads letters and whole-word guesses from chat", () => {
    expect(parseHangmanGuess(" A ", 3)).toEqual({ kind: "letter", letter: "a" });
    expect(parseHangmanGuess("Cat", 3)).toEqual({ kind: "word", word: "cat" });
    expect(parseHangmanGuess("hello there", 3)).toBeNull();
    expect(parseHangmanGuess("ab", 3)).toBeNull();
    expect(parseHangmanGuess("1", 3)).toBeNull();
    expect(parseHangmanGuess("é", 3)).toBeNull();
  });
  it("draws more of the figure as lives go", () => {
    const h = newHangman("cat");
    expect(gallows(h)).toBe("");
    guessLetter(h, "z");
    expect(gallows(h).length).toBeGreaterThan(0);
  });
});

describe("scramble", () => {
  it("keeps the letters and changes the order", () => {
    for (const w of ["pirate", "anchor", "dragon"]) {
      const s = scramble(w, Math.random);
      expect([...s].sort().join("")).toBe([...w].sort().join(""));
      expect(s).not.toBe(w);
    }
  });
  it("still differs when the rng would keep the order", () => {
    const s = scramble("abcdef", () => 0.999999);
    expect(s).not.toBe("abcdef");
  });
  it("leaves a word of one repeated letter alone", () => {
    expect(scramble("aaa", Math.random)).toBe("aaa");
  });
  it("accepts the word in any case with spaces around", () => {
    expect(isScrambleAnswer("  PiRaTe ", "pirate")).toBe(true);
    expect(isScrambleAnswer("pirates", "pirate")).toBe(false);
  });
});

describe("guess the number", () => {
  it("reads 1-100 typed on its own", () => {
    expect(parseNumberGuess(" 42 ")).toBe(42);
    expect(parseNumberGuess("100")).toBe(100);
    expect(parseNumberGuess("0")).toBeNull();
    expect(parseNumberGuess("101")).toBeNull();
    expect(parseNumberGuess("12 apples")).toBeNull();
    expect(parseNumberGuess("-5")).toBeNull();
  });
  it("says higher, lower or correct", () => {
    expect(compareGuess(50, 30)).toBe("higher");
    expect(compareGuess(50, 70)).toBe("lower");
    expect(compareGuess(50, 50)).toBe("correct");
  });
});
