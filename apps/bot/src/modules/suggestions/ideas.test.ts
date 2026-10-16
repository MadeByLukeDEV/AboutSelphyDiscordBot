import { describe, expect, it } from "vitest";
import { ideaLines } from "./rules";

describe("the best-liked list", () => {
  const base = { channelId: "10", messageId: "20" };
  it("ranks with medals, shows signed scores and links the post", () => {
    const lines = ideaLines(
      [
        { ...base, number: 3, content: "Add a movie night", score: 12 },
        { ...base, number: 9, content: "More emotes", score: 0 },
        { ...base, number: 4, content: "x", score: -2 },
        { ...base, number: 5, content: "y", score: 1 },
      ],
      "99",
      (t) => t,
    );
    expect(lines[0]).toBe("🥇 **+12** · [#3](https://discord.com/channels/99/10/20) Add a movie night");
    expect(lines[1]).toContain("🥈 **0**");
    expect(lines[2]).toContain("**-2**");
    expect(lines[3]!.startsWith("4. ")).toBe(true);
  });
  it("cuts long text and uses the given escaping", () => {
    const [line] = ideaLines([{ ...base, number: 1, content: "a".repeat(200), score: 1 }], "99", (t) => t.toUpperCase());
    expect(line).toContain("A".repeat(89) + "…");
  });
});
