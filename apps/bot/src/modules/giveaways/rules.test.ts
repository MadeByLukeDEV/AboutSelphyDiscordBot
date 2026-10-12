import { describe, expect, it } from "vitest";
import { giveawayInput } from "@aboutselphy/shared/giveaways";
import { buildGiveawayMessage, enterControlId, entryProblem, nextRoundEnd, problemText, requirementLines, parseEnterControl, pickWeightedWinners, pickWinners, ticketsFor, winnerAnnouncement, type GiveawayView } from "./rules";

describe("pickWinners", () => {
  const people = Array.from({ length: 10 }, (_, i) => `u${i}`);

  it("picks the requested number of different people", () => {
    const winners = pickWinners(people, 3);
    expect(winners).toHaveLength(3);
    expect(new Set(winners).size).toBe(3);
    for (const w of winners) expect(people).toContain(w);
  });

  it("returns everyone when there are fewer than asked, and nobody for none", () => {
    expect(pickWinners(["a", "b"], 5).sort()).toEqual(["a", "b"]);
    expect(pickWinners([], 3)).toEqual([]);
    expect(pickWinners(people, 0)).toEqual([]);
  });

  it("ignores duplicates in the pool", () => {
    expect(pickWinners(["a", "a", "a"], 2)).toEqual(["a"]);
  });

  it("is uniform: over many draws everyone wins about equally often", () => {
    const counts = new Map<string, number>();
    const draws = 20_000;
    for (let i = 0; i < draws; i++) for (const w of pickWinners(["a", "b", "c", "d"], 1)) counts.set(w, (counts.get(w) ?? 0) + 1);
    for (const c of counts.values()) expect(Math.abs(c / draws - 0.25)).toBeLessThan(0.02);
  });

  it("does not modify the input", () => {
    const copy = [...people];
    pickWinners(people, 4);
    expect(people).toEqual(copy);
  });
});

describe("control id", () => {
  it("round-trips and rejects anything else", () => {
    expect(parseEnterControl(enterControlId("cm1abc2def3ghi"))).toBe("cm1abc2def3ghi");
    for (const bad of ["gw:enter:", "gw:enter:short", "gw:leave:cm1abc2def3ghi", "tk:open", "gw:enter:CM1ABC2DEF3GHI", "gw:enter:cm1abc2def3ghi:x"]) {
      expect(parseEnterControl(bad), bad).toBeNull();
    }
  });
});

describe("the message", () => {
  const view = (over: Partial<GiveawayView> = {}): GiveawayView => ({
    id: "cm1abc2def3ghi",
    prize: "**Nitro** <@&999999999999999999>",
    description: "Good luck [link](https://x.test)",
    winnerCount: 2,
    endsAt: new Date("2026-10-20T12:00:00Z"),
    hostName: "Selphy",
    requiredRoleId: null,
    ended: false,
    winners: [],
    ...over,
  });
  const text = (m: ReturnType<typeof buildGiveawayMessage>) => JSON.stringify(m.embeds[0]!.toJSON());

  it("escapes the prize and the text, so they can't ping or link", () => {
    const t = text(buildGiveawayMessage(view()));
    expect(t).toContain("\\\\*\\\\*Nitro\\\\*\\\\*");
    expect(t).not.toMatch(/(?<!\\\\)<@&99/);
    expect(buildGiveawayMessage(view()).allowedMentions).toEqual({ parse: [] });
  });

  it("shows how it ends, the winner count and the needed role while running, with an enabled button", () => {
    const m = buildGiveawayMessage(view({ requiredRoleId: "123456789012345678" }));
    expect(text(m)).toContain("Press the button to enter");
    expect(text(m)).toContain("<@&123456789012345678>");
    expect((m.components[0]!.toJSON().components[0] as { disabled?: boolean }).disabled).toBeFalsy();
  });

  it("shows the winners once ended and disables the button", () => {
    const m = buildGiveawayMessage(view({ ended: true, winners: ["111111111111111111", "222222222222222222"], entryCount: 40 }));
    expect(text(m)).toContain("<@111111111111111111>");
    expect(text(m)).toContain("Entries");
    expect((m.components[0]!.toJSON().components[0] as { disabled?: boolean }).disabled).toBe(true);
    expect(text(buildGiveawayMessage(view({ ended: true, winners: [] })))).toContain("nobody won");
  });

  it("pings only the winners in the announcement", () => {
    const a = winnerAnnouncement("Nitro", ["111111111111111111"], false);
    expect(a.content).toContain("<@111111111111111111>");
    expect(a.allowedMentions).toEqual({ parse: [], users: ["111111111111111111"] });
    expect(winnerAnnouncement("Nitro", [], false).allowedMentions).toEqual({ parse: [], users: [] });
  });
});

describe("giveawayInput", () => {
  const base = { channelId: "123456789012345678", prize: "Nitro", description: "", winnerCount: 1, endsAt: new Date(Date.now() + 3_600_000).toISOString(), requiredRoleId: "", pingRoleId: "", start: true };
  const parse = (over: Record<string, unknown>) => giveawayInput.safeParse({ ...base, ...over });

  it("accepts a normal giveaway", () => {
    expect(parse({}).success).toBe(true);
  });

  it("needs a prize, 1 to 20 winners and an end between a minute and a year ahead", () => {
    expect(parse({ prize: "  " }).success).toBe(false);
    expect(parse({ winnerCount: 0 }).success).toBe(false);
    expect(parse({ winnerCount: 21 }).success).toBe(false);
    expect(parse({ endsAt: "soon" }).success).toBe(false);
    expect(parse({ endsAt: new Date(Date.now() + 5000).toISOString() }).success).toBe(false);
    expect(parse({ endsAt: new Date(Date.now() + 400 * 86_400_000).toISOString() }).success).toBe(false);
  });

  it("refuses bad ids", () => {
    expect(parse({ channelId: "abc" }).success).toBe(false);
    expect(parse({ requiredRoleId: "everyone" }).success).toBe(false);
  });
});

describe("weighted draw", () => {
  it("gives one ticket plus the bonus, and the bonus only to the role's members", () => {
    expect(ticketsFor(false, 3)).toBe(1);
    expect(ticketsFor(true, 3)).toBe(4);
    expect(ticketsFor(true, 0)).toBe(1);
  });
  it("picks distinct winners, never more than there are people", () => {
    const people = ["a", "b", "c", "d"].map((id) => ({ id, weight: 1 }));
    expect(new Set(pickWeightedWinners(people, 3)).size).toBe(3);
    expect(pickWeightedWinners(people, 10).sort()).toEqual(["a", "b", "c", "d"]);
    expect(pickWeightedWinners([], 2)).toEqual([]);
    expect(pickWeightedWinners(people, 0)).toEqual([]);
  });
  it("counts a person once even if listed twice", () => {
    expect(pickWeightedWinners([{ id: "a", weight: 1 }, { id: "a", weight: 5 }], 2)).toEqual(["a"]);
  });
  it("favours a heavier candidate in proportion (3 tickets against 1 wins about 75 % of single draws)", () => {
    let heavy = 0;
    const draws = 20_000;
    for (let i = 0; i < draws; i++) if (pickWeightedWinners([{ id: "heavy", weight: 4 }, { id: "light", weight: 1 }], 1)[0] === "heavy") heavy++;
    expect(heavy / draws).toBeGreaterThan(0.77);
    expect(heavy / draws).toBeLessThan(0.83);
  });
  it("behaves like a plain draw with equal weights", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 20_000; i++) for (const w of pickWeightedWinners(["a", "b", "c", "d"].map((id) => ({ id, weight: 1 })), 1)) counts.set(w, (counts.get(w) ?? 0) + 1);
    for (const n of counts.values()) expect(n / 20_000).toBeGreaterThan(0.22);
  });
  it("shows the bonus in the post while it runs", () => {
    const base = { id: "abcdefghij12", prize: "Prize", description: "", winnerCount: 1, endsAt: new Date("2026-12-01T00:00:00Z"), hostName: "Host", requiredRoleId: null, ended: false, winners: [] };
    const text = JSON.stringify(buildGiveawayMessage({ ...base, bonusRoleId: "123456789012345678", bonusEntries: 2 }).embeds[0]!.toJSON());
    expect(text).toContain("2 extra chances");
    expect(JSON.stringify(buildGiveawayMessage(base).embeds[0]!.toJSON())).not.toContain("Bonus");
  });
});

describe("entry requirements", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const none = { minAccountDays: 0, minMemberDays: 0, minLevel: 0 };

  it("no requirements means everyone qualifies", () => {
    expect(entryProblem(none, { accountCreatedAt: days(0), joinedAt: null, level: 0 }, now)).toBeNull();
  });
  it("checks the account age, the time in the server and the level, in that order", () => {
    const req = { minAccountDays: 30, minMemberDays: 7, minLevel: 5 };
    expect(entryProblem(req, { accountCreatedAt: days(10), joinedAt: days(10), level: 9 }, now)).toEqual({ kind: "account", need: 30 });
    expect(entryProblem(req, { accountCreatedAt: days(100), joinedAt: days(2), level: 9 }, now)).toEqual({ kind: "member", need: 7 });
    expect(entryProblem(req, { accountCreatedAt: days(100), joinedAt: days(20), level: 4 }, now)).toEqual({ kind: "level", need: 5 });
    expect(entryProblem(req, { accountCreatedAt: days(100), joinedAt: days(20), level: 5 }, now)).toBeNull();
  });
  it("a member without a known join time can't show they have been here long enough", () => {
    expect(entryProblem({ ...none, minMemberDays: 1 }, { accountCreatedAt: days(100), joinedAt: null, level: 0 }, now)).toEqual({ kind: "member", need: 1 });
  });
  it("says what is missing, and lists the requirements in the post", () => {
    expect(problemText({ kind: "account", need: 1 })).toContain("1 day old");
    expect(problemText({ kind: "level", need: 5 })).toContain("level 5");
    expect(requirementLines({ minAccountDays: 30, minMemberDays: 0, minLevel: 3 })).toEqual(["Discord account at least 30 days old", "Level 3 or higher"]);
    expect(requirementLines(none)).toEqual([]);
  });
  it("the running post shows the requirements", () => {
    const base = { id: "abcdefghij12", prize: "P", description: "", winnerCount: 1, endsAt: new Date("2026-12-01T00:00:00Z"), hostName: "H", requiredRoleId: null, ended: false, winners: [] };
    expect(JSON.stringify(buildGiveawayMessage({ ...base, requirements: { minAccountDays: 0, minMemberDays: 7, minLevel: 0 } }).embeds[0]!.toJSON())).toContain("In this server for at least 7 days");
  });
});

describe("repeating", () => {
  it("the next round lasts as long as the last one, at least five minutes", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    expect(nextRoundEnd(new Date("2026-11-05T12:00:00Z"), new Date("2026-11-06T12:00:00Z"), now)).toEqual(new Date("2026-11-07T12:00:00Z"));
    expect(nextRoundEnd(null, now, now)).toEqual(new Date("2026-11-06T12:05:00Z"));
    expect(nextRoundEnd(new Date("2026-11-06T11:59:00Z"), now, now)).toEqual(new Date("2026-11-06T12:05:00Z"));
  });
});
