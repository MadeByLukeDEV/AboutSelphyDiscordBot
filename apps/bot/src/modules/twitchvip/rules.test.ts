import { describe, expect, it } from "vitest";
import { TWITCH_LOGIN_PATTERN, vipSettingsSchema } from "@aboutselphy/shared/twitchvip";
import { planVerifiedLink, planVipRoles } from "./rules";

const links = [
  { discordUserId: "d1", twitchUserId: "t1" },
  { discordUserId: "d2", twitchUserId: "t2" },
  { discordUserId: "d3", twitchUserId: "t3" },
];

describe("planVipRoles", () => {
  it("gives the role to a linked VIP who lacks it", () => {
    expect(planVipRoles(links, new Set(["t1"]), new Set())).toEqual({ give: ["d1"], take: [] });
  });
  it("takes it from a linked member who is no longer VIP", () => {
    expect(planVipRoles(links, new Set(["t1"]), new Set(["d1", "d2"]))).toEqual({ give: [], take: ["d2"] });
  });
  it("does nothing when everything already matches", () => {
    expect(planVipRoles(links, new Set(["t1", "t3"]), new Set(["d1", "d3"]))).toEqual({ give: [], take: [] });
  });
  it("never touches members without a link, whatever they hold", () => {
    const plan = planVipRoles(links, new Set(["t9"]), new Set(["stranger"]));
    expect(plan.take).not.toContain("stranger");
    expect(plan.give).toEqual([]);
  });
  it("an empty VIP list takes the role from every linked holder (the caller never passes it on a failed read)", () => {
    expect(planVipRoles(links, new Set(), new Set(["d1", "d2", "d3"]))).toEqual({ give: [], take: ["d1", "d2", "d3"] });
  });
});

describe("planVerifiedLink", () => {
  it("links a free account", () => {
    expect(planVerifiedLink("d1", null, null)).toEqual({ action: "link", remove: [] });
  });
  it("replaces the member's own older link", () => {
    expect(planVerifiedLink("d1", null, { id: "L1", discordUserId: "d1", approved: true })).toEqual({ action: "link", remove: ["L1"] });
  });
  it("keeps an account that another member has confirmed", () => {
    expect(planVerifiedLink("d1", { id: "L2", discordUserId: "d2", approved: true }, null)).toEqual({ action: "taken" });
  });
  it("proof beats somebody else's unconfirmed claim", () => {
    expect(planVerifiedLink("d1", { id: "L2", discordUserId: "d2", approved: false }, { id: "L1", discordUserId: "d1", approved: false })).toEqual({ action: "link", remove: ["L2", "L1"] });
  });
  it("is fine when the member already holds that very account (own link, same row)", () => {
    expect(planVerifiedLink("d1", { id: "L1", discordUserId: "d1", approved: true }, { id: "L1", discordUserId: "d1", approved: true })).toEqual({ action: "link", remove: ["L1"] });
  });
});

describe("settings and logins", () => {
  it("needs a role to be switched on", () => {
    expect(vipSettingsSchema.safeParse({ enabled: true, roleId: "" }).success).toBe(false);
    expect(vipSettingsSchema.safeParse({ enabled: true, roleId: "123456789012345678" }).success).toBe(true);
    expect(vipSettingsSchema.safeParse({ enabled: false, roleId: "" }).success).toBe(true);
    expect(vipSettingsSchema.safeParse({ enabled: false, roleId: "admins" }).success).toBe(false);
  });
  it("accepts only real Twitch logins", () => {
    for (const ok of ["abc", "Some_User1", "a".repeat(25)]) expect(TWITCH_LOGIN_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ["ab", "a".repeat(26), "bad name", "x/y", "@name", "name?key=1", ""]) expect(TWITCH_LOGIN_PATTERN.test(bad), bad).toBe(false);
  });
});
