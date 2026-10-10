import { describe, expect, it } from "vitest";
import { countingSettingsSchema } from "@aboutselphy/shared/counting";
import { judge, mistakeMessage, parseCount } from "./rules";

describe("parseCount", () => {
  it("reads a leading whole number", () => {
    expect(parseCount("12")).toBe(12);
    expect(parseCount("  12 nice  ")).toBe(12);
    expect(parseCount("７")).toBe(7); // full-width digit
    expect(parseCount("1\u200b2")).toBe(12);
  });

  it("ignores everything else, so chat is allowed", () => {
    for (const text of ["", "hello", "12abc", "1.5", "-3", "one", "x 12", "1234567890"]) expect(parseCount(text), text).toBeNull();
  });
});

describe("judge", () => {
  const base = { current: 5, number: 6, userId: "a", lastUserId: "b", allowConsecutive: false };
  it("accepts the next number from someone else", () => expect(judge(base)).toBe("ok"));
  it("refuses a wrong number", () => {
    expect(judge({ ...base, number: 7 })).toBe("wrong");
    expect(judge({ ...base, number: 5 })).toBe("wrong");
  });
  it("refuses the same member twice unless allowed", () => {
    expect(judge({ ...base, lastUserId: "a" })).toBe("same-user");
    expect(judge({ ...base, lastUserId: "a", allowConsecutive: true })).toBe("ok");
  });
  it("starts at 1", () => expect(judge({ current: 0, number: 1, userId: "a", lastUserId: null, allowConsecutive: false })).toBe("ok"));
});

describe("mistakeMessage and settings", () => {
  it("names the next number", () => {
    expect(mistakeMessage("1", 9, true)).toContain("**9**");
    expect(mistakeMessage("1", 9, false)).toContain("**10**");
  });
  it("needs a channel when on", () => {
    const base = { enabled: true, channelId: "123456789012345678", allowConsecutive: false, resetOnMistake: true };
    expect(countingSettingsSchema.safeParse(base).success).toBe(true);
    expect(countingSettingsSchema.safeParse({ ...base, channelId: "" }).success).toBe(false);
    expect(countingSettingsSchema.safeParse({ ...base, enabled: false, channelId: "" }).success).toBe(true);
  });
});
