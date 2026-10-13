import { PermissionFlagsBits as P } from "discord.js";
import { describe, expect, it } from "vitest";
import { checkCopy, checkMerge, planMove, isPowerful, protectionOf, type ManageFacts } from "./manage-rules";

const base: ManageFacts = { id: "222222222222222222", guildId: "111111111111111111", managed: false, position: 3, permissions: 0n };
const none = new Set<string>();

describe("protectionOf", () => {
  it("lets an ordinary role below the bot go", () => expect(protectionOf(base, 10, none)).toBeNull());

  it("refuses integration-managed roles", () => expect(protectionOf({ ...base, managed: true }, 10, none)).toBe("managed"));

  it("refuses roles at or above the bot's top role", () => {
    expect(protectionOf({ ...base, position: 10 }, 10, none)).toBe("aboveBot");
    expect(protectionOf({ ...base, position: 11 }, 10, none)).toBe("aboveBot");
    expect(protectionOf({ ...base, position: 9 }, 10, none)).toBeNull();
  });

  it("refuses the staff roles from the environment", () => expect(protectionOf(base, 10, new Set([base.id]))).toBe("staff"));

  it("checks managed first, then position, then staff", () => {
    expect(protectionOf({ ...base, managed: true, position: 50 }, 10, new Set([base.id]))).toBe("managed");
    expect(protectionOf({ ...base, position: 50 }, 10, new Set([base.id]))).toBe("aboveBot");
  });
});

describe("isPowerful", () => {
  it("flags permissions that change the server or other members", () => {
    expect(isPowerful(P.BanMembers)).toBe(true);
    expect(isPowerful(P.Administrator | P.SendMessages)).toBe(true);
    expect(isPowerful(P.SendMessages | P.ViewChannel)).toBe(false);
    expect(isPowerful(0n)).toBe(false);
  });
});

describe("checkMerge", () => {
  const input = { sourceIds: ["222222222222222222"], targetId: "333333333333333333", guildId: "111111111111111111" };
  it("accepts an assignable target and ordinary sources", () => expect(checkMerge(input, { assignable: true }, none)).toEqual({ ok: true }));
  it("refuses a missing, unassignable or staff target", () => {
    expect(checkMerge(input, null, none)).toEqual({ ok: false, reason: "target-invalid" });
    expect(checkMerge(input, { assignable: false }, none)).toEqual({ ok: false, reason: "target-invalid" });
    expect(checkMerge(input, { assignable: true }, new Set([input.targetId]))).toEqual({ ok: false, reason: "target-invalid" });
  });
  it("refuses @everyone or the target as a source", () => {
    expect(checkMerge({ ...input, sourceIds: [input.guildId] }, { assignable: true }, none)).toEqual({ ok: false, reason: "source-invalid" });
    expect(checkMerge({ ...input, sourceIds: [input.targetId] }, { assignable: true }, none)).toEqual({ ok: false, reason: "source-invalid" });
  });
});

describe("moving and copying", () => {
  it("moves one place, never above the bot or below the first place", () => {
    expect(planMove(5, "up", 10)).toBe(6);
    expect(planMove(9, "up", 10)).toBeNull();
    expect(planMove(5, "down", 10)).toBe(4);
    expect(planMove(1, "down", 10)).toBeNull();
  });
  it("refuses to copy from a powerful role or onto itself", () => {
    expect(checkCopy("a", "b", 0n)).toEqual({ ok: true });
    expect(checkCopy("a", "a", 0n)).toEqual({ ok: false, reason: "same" });
    expect(checkCopy("a", "b", P.Administrator)).toEqual({ ok: false, reason: "source-powerful" });
    expect(checkCopy("a", "b", P.KickMembers)).toEqual({ ok: false, reason: "source-powerful" });
    expect(checkCopy("a", "b", P.SendMessages | P.ViewChannel)).toEqual({ ok: true });
  });
});
