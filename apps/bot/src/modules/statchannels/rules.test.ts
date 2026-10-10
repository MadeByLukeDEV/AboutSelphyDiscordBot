import { describe, expect, it } from "vitest";
import { renderStatName, statChannelInput } from "@aboutselphy/shared/stat-channels";

describe("renderStatName", () => {
  it("fills the number with thousands separators", () => {
    expect(renderStatName("Members: {count}", 1234)).toBe("Members: 1,234");
    expect(renderStatName("{count} boosts", 0)).toBe("0 boosts");
  });

  it("never prints a negative or fractional number", () => {
    expect(renderStatName("{count}", -5)).toBe("0");
    expect(renderStatName("{count}", 3.9)).toBe("3");
  });

  it("removes control and invisible characters and collapses spaces", () => {
    expect(renderStatName("Mem\u200bbers\n\n:   {count}\u202e", 7)).toBe("Members: 7");
  });

  it("stays within Discord's 100 characters", () => {
    expect(renderStatName("x".repeat(95) + " {count}", 123456).length).toBeLessThanOrEqual(100);
  });
});

describe("statChannelInput", () => {
  const base = { channelId: "123456789012345678", kind: "members", template: "Members: {count}" };
  it("needs {count}, a known kind and a real channel id", () => {
    expect(statChannelInput.safeParse(base).success).toBe(true);
    expect(statChannelInput.safeParse({ ...base, template: "Members" }).success).toBe(false);
    expect(statChannelInput.safeParse({ ...base, kind: "online" }).success).toBe(false);
    expect(statChannelInput.safeParse({ ...base, channelId: "abc" }).success).toBe(false);
    expect(statChannelInput.safeParse({ ...base, template: "x".repeat(100) + "{count}" }).success).toBe(false);
  });
});
