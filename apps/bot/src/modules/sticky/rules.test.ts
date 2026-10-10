import { describe, expect, it } from "vitest";
import { MAX_STICKY, stickyInput } from "@aboutselphy/shared/sticky";
import { buildStickyMessage } from "./rules";

describe("buildStickyMessage", () => {
  it("keeps staff markdown, allows no mentions and is capped", () => {
    const m = buildStickyMessage("**Read the rules** <@&999999999999999999> @everyone");
    expect(m.embeds[0]!.toJSON().description).toBe("**Read the rules** <@&999999999999999999> @everyone");
    expect(m.allowedMentions).toEqual({ parse: [] });
    expect(buildStickyMessage("x".repeat(3000)).embeds[0]!.toJSON().description!.length).toBeLessThanOrEqual(1500);
  });
});

describe("stickyInput", () => {
  const base = { channelId: "123456789012345678", content: "Be kind.", enabled: true };
  it("needs a channel and some text", () => {
    expect(stickyInput.safeParse(base).success).toBe(true);
    expect(stickyInput.safeParse({ ...base, content: "  " }).success).toBe(false);
    expect(stickyInput.safeParse({ ...base, content: "x".repeat(1501) }).success).toBe(false);
    expect(stickyInput.safeParse({ ...base, channelId: "general" }).success).toBe(false);
    expect(MAX_STICKY).toBe(10);
  });
});
