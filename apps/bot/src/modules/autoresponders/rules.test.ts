import { describe, expect, it } from "vitest";
import { autoResponderInput } from "@aboutselphy/shared/auto-responders";
import { allowedIn, Cooldowns, matches, normalizeForMatch, renderResponse } from "./rules";

describe("normalizeForMatch", () => {
  it("folds case, width, invisible characters and spaces", () => expect(normalizeForMatch("  Ｈello\u200b   WORLD ")).toBe("hello world"));
});

describe("matches", () => {
  it("word: whole words only", () => {
    expect(matches("word", "cat", "my cat!")).toBe(true);
    expect(matches("word", "cat", "Cat")).toBe(true);
    expect(matches("word", "cat", "category")).toBe(false);
    expect(matches("word", "cat", "bobcat")).toBe(false);
    expect(matches("word", "good morning", "well, good   morning everyone")).toBe(true);
  });

  it("contains and exact", () => {
    expect(matches("contains", "cat", "category")).toBe(true);
    expect(matches("exact", "ping", "Ping")).toBe(true);
    expect(matches("exact", "ping", "ping pong")).toBe(false);
  });

  it("treats the trigger as literal text, whatever it contains", () => {
    expect(matches("word", "a.c", "abc")).toBe(false);
    expect(matches("word", "a.c", "a.c")).toBe(true);
    expect(matches("word", "(x+)+$", "(x+)+$ hi")).toBe(true);
    expect(() => matches("word", "[", "hello")).not.toThrow();
    expect(matches("contains", "", "anything")).toBe(false);
  });

  it("stays fast on hostile input", () => {
    const started = Date.now();
    matches("word", "a".repeat(100), "a".repeat(5000));
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe("allowedIn and renderResponse", () => {
  it("empty list means everywhere", () => {
    expect(allowedIn([], "1")).toBe(true);
    expect(allowedIn(["2"], "1")).toBe(false);
    expect(allowedIn(["1", "2"], "1")).toBe(true);
  });
  it("fills the variables and escapes the name", () => {
    const text = renderResponse("Hi {user}, {username}", { id: "111111111111111111", username: "Se*lphy" });
    expect(text).toContain("<@111111111111111111>");
    expect(text).toContain("Se\\*lphy");
  });
});

describe("Cooldowns", () => {
  it("allows one use per window", () => {
    const c = new Cooldowns();
    expect(c.take("k", 30, 0)).toBe(true);
    expect(c.take("k", 30, 10_000)).toBe(false);
    expect(c.take("k", 30, 31_000)).toBe(true);
    expect(c.take("other", 30, 10_000)).toBe(true);
  });
});

describe("autoResponderInput", () => {
  const base = { trigger: "hello", matchType: "word", response: "Hi!", cooldownSeconds: 30, channelIds: [], enabled: true };
  it("validates the fields", () => {
    expect(autoResponderInput.safeParse(base).success).toBe(true);
    expect(autoResponderInput.safeParse({ ...base, trigger: " " }).success).toBe(false);
    expect(autoResponderInput.safeParse({ ...base, matchType: "regex" }).success).toBe(false);
    expect(autoResponderInput.safeParse({ ...base, cooldownSeconds: -1 }).success).toBe(false);
    expect(autoResponderInput.safeParse({ ...base, channelIds: ["x"] }).success).toBe(false);
  });
});
