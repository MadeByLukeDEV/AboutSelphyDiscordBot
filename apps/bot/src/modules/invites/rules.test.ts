import { describe, expect, it } from "vitest";
import { describeSource, detectInvite, snapshotOf, statsLine, type InviteInfo } from "./rules";

const inv = (code: string, uses: number, over: Partial<InviteInfo> = {}): InviteInfo => ({ code, uses, maxUses: 0, inviterId: "u1", ...over });

describe("detectInvite", () => {
  const before = snapshotOf([inv("aaa", 3), inv("bbb", 10, { inviterId: "u2" })]);

  it("finds the one invite whose uses went up", () => {
    expect(detectInvite(before, [inv("aaa", 3), inv("bbb", 11, { inviterId: "u2" })], null)).toEqual({ source: "invite", code: "bbb", inviterId: "u2" });
  });
  it("counts a brand new invite that was already used", () => {
    expect(detectInvite(before, [inv("aaa", 3), inv("bbb", 10, { inviterId: "u2" }), inv("ccc", 1, { inviterId: "u3" })], null)).toEqual({ source: "invite", code: "ccc", inviterId: "u3" });
  });
  it("blames an invite that vanished on its last use", () => {
    const snap = snapshotOf([inv("one-use", 0, { maxUses: 1, inviterId: "u9" }), inv("aaa", 3)]);
    expect(detectInvite(snap, [inv("aaa", 3)], null)).toEqual({ source: "invite", code: "one-use", inviterId: "u9" });
  });
  it("does not blame an invite that vanished for another reason (deleted, expired, not on its last use)", () => {
    const snap = snapshotOf([inv("old", 2, { maxUses: 10 }), inv("aaa", 3)]);
    expect(detectInvite(snap, [inv("aaa", 3)], null)).toEqual({ source: "unknown" });
  });
  it("never guesses between two candidates", () => {
    expect(detectInvite(before, [inv("aaa", 4), inv("bbb", 11, { inviterId: "u2" })], null)).toEqual({ source: "unknown" });
    const two = snapshotOf([inv("x", 0, { maxUses: 1 }), inv("y", 0, { maxUses: 1 })]);
    expect(detectInvite(two, [], null)).toEqual({ source: "unknown" });
  });
  it("uses the custom URL only when no invite explains the join", () => {
    expect(detectInvite(before, [inv("aaa", 3), inv("bbb", 10, { inviterId: "u2" })], { before: 5, after: 6 })).toEqual({ source: "vanity" });
    expect(detectInvite(before, [inv("aaa", 4), inv("bbb", 10, { inviterId: "u2" })], { before: 5, after: 6 })).toEqual({ source: "invite", code: "aaa", inviterId: "u1" });
  });
  it("is unknown when nothing changed", () => {
    expect(detectInvite(before, [inv("aaa", 3), inv("bbb", 10, { inviterId: "u2" })], { before: 5, after: 5 })).toEqual({ source: "unknown" });
    expect(detectInvite(snapshotOf([]), [], null)).toEqual({ source: "unknown" });
  });
});

describe("text", () => {
  it("describes each source", () => {
    expect(describeSource({ source: "invite", code: "abc", inviterId: "u1" }, "Sam")).toBe("Sam (invite `abc`)");
    expect(describeSource({ source: "invite", code: "abc", inviterId: null }, null)).toBe("invite `abc`");
    expect(describeSource({ source: "vanity" }, null)).toBe("the server's custom URL");
    expect(describeSource({ source: "unknown" }, null)).toBe("unknown");
  });
  it("writes the stats line with the right plural", () => {
    expect(statsLine({ total: 1, here: 1 })).toBe("1 member joined through their invites: 1 still here, 0 left.");
    expect(statsLine({ total: 12, here: 9 })).toBe("12 members joined through their invites: 9 still here, 3 left.");
  });
});
