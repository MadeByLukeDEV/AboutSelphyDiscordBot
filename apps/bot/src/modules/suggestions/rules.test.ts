import { describe, expect, it } from "vitest";
import { canTransition, decisionInput, suggestionSettingsSchema } from "@aboutselphy/shared/suggestions";
import { buildSuggestionMessage, cooldownRemaining, nextVote, parseVoteControl, voteControlId, type SuggestionView } from "./rules";

const view = (over: Partial<SuggestionView> = {}): SuggestionView => ({
  id: "cm1abc2def3ghi",
  number: 7,
  authorId: "123456789012345678",
  authorName: "Bob **bold** <@&999999999999999999>",
  content: "Add a **music** channel <@&999999999999999999> https://x.test",
  status: "open",
  up: 3,
  down: 1,
  decidedByName: null,
  decisionReason: "",
  ...over,
});
const text = (m: ReturnType<typeof buildSuggestionMessage>) => JSON.stringify(m.embeds[0]!.toJSON());

describe("the message", () => {
  it("escapes what the member wrote, so it can't ping or link, and pings nobody", () => {
    const m = buildSuggestionMessage(view());
    expect(text(m)).toContain("\\\\*\\\\*music\\\\*\\\\*");
    expect(text(m)).not.toMatch(/(?<!\\\\)<@&99/);
    expect(text(m)).toContain("<@123456789012345678>");
    expect(m.allowedMentions).toEqual({ parse: [] });
  });

  it("shows the votes and keeps voting enabled while open", () => {
    const m = buildSuggestionMessage(view());
    expect(text(m)).toContain("👍 3");
    const buttons = m.components[0]!.toJSON().components as Array<{ disabled?: boolean }>;
    expect(buttons.every((b) => !b.disabled)).toBe(true);
  });

  it("shows who decided and why, and closes voting once decided", () => {
    const m = buildSuggestionMessage(view({ status: "denied", decidedByName: "Mod", decisionReason: "Not now" }));
    expect(text(m)).toContain("Denied by");
    expect(text(m)).toContain("Not now");
    const buttons = m.components[0]!.toJSON().components as Array<{ disabled?: boolean }>;
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});

describe("vote controls", () => {
  it("round-trips and rejects anything else", () => {
    expect(parseVoteControl(voteControlId("cm1abc2def3ghi", 1))).toEqual({ id: "cm1abc2def3ghi", value: 1 });
    expect(parseVoteControl(voteControlId("cm1abc2def3ghi", -1))).toEqual({ id: "cm1abc2def3ghi", value: -1 });
    for (const bad of ["sg:up:", "sg:up:short", "sg:sideways:cm1abc2def3ghi", "gw:enter:cm1abc2def3ghi", "sg:up:CM1ABC2DEF3GHI", "sg:up:cm1abc2def3ghi:x"]) {
      expect(parseVoteControl(bad), bad).toBeNull();
    }
  });

  it("pressing the same button again takes the vote back, the other switches sides", () => {
    expect(nextVote(null, 1)).toBe(1);
    expect(nextVote(1, 1)).toBeNull();
    expect(nextVote(1, -1)).toBe(-1);
    expect(nextVote(-1, 1)).toBe(1);
  });
});

describe("cooldown", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  it("counts the seconds still to wait", () => {
    expect(cooldownRemaining(null, now, 60)).toBe(0);
    expect(cooldownRemaining(new Date(now.getTime() - 20_000), now, 60)).toBe(40);
    expect(cooldownRemaining(new Date(now.getTime() - 61_000), now, 60)).toBe(0);
    expect(cooldownRemaining(new Date(now.getTime() - 1000), now, 0)).toBe(0);
  });
});

describe("status changes and settings", () => {
  it("lets open become any decision and approved become implemented, nothing else", () => {
    for (const to of ["approved", "denied", "implemented"] as const) expect(canTransition("open", to)).toBe(true);
    expect(canTransition("approved", "implemented")).toBe(true);
    expect(canTransition("approved", "denied")).toBe(false);
    expect(canTransition("denied", "approved")).toBe(false);
    expect(canTransition("implemented", "implemented")).toBe(false);
  });

  it("validates decisions and settings", () => {
    expect(decisionInput.safeParse({ id: "x", status: "approved", reason: "" }).success).toBe(true);
    expect(decisionInput.safeParse({ id: "x", status: "open", reason: "" }).success).toBe(false);
    expect(decisionInput.safeParse({ id: "x", status: "denied", reason: "y".repeat(301) }).success).toBe(false);
    expect(suggestionSettingsSchema.safeParse({ enabled: true, channelId: "", cooldownSeconds: 60 }).success).toBe(false);
    expect(suggestionSettingsSchema.safeParse({ enabled: true, channelId: "123456789012345678", cooldownSeconds: 60 }).success).toBe(true);
    expect(suggestionSettingsSchema.safeParse({ enabled: false, channelId: "", cooldownSeconds: 4000 }).success).toBe(false);
  });
});
