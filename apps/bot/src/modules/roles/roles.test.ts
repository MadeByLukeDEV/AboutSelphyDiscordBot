import { PermissionFlagsBits as P } from "discord.js";
import { describe, expect, it } from "vitest";
import { isUnicodeEmoji, rolePanelInput } from "@aboutselphy/shared/role-panel";
import { buildPanelMessage, buttonId, parsePanelCustomId, planToggle, type PanelView } from "./panel";
import { whyUnassignable, type RoleFacts } from "./safety";

const role = (over: Partial<RoleFacts> = {}): RoleFacts => ({ id: "111111111111111111", guildId: "999999999999999999", managed: false, position: 3, permissions: 0n, ...over });

describe("whyUnassignable", () => {
  it("allows a plain cosmetic role below the bot", () => {
    expect(whyUnassignable(role({ permissions: P.ViewChannel | P.SendMessages }), 10)).toBeNull();
  });

  it("refuses @everyone, managed roles and roles at or above the bot", () => {
    expect(whyUnassignable(role({ id: "999999999999999999" }), 10)).toBe("everyone");
    expect(whyUnassignable(role({ managed: true }), 10)).toBe("managed");
    expect(whyUnassignable(role({ position: 10 }), 10)).toBe("aboveBot");
    expect(whyUnassignable(role({ position: 11 }), 10)).toBe("aboveBot");
  });

  it("refuses any role with real power", () => {
    for (const power of [P.Administrator, P.ManageGuild, P.ManageRoles, P.KickMembers, P.BanMembers, P.ModerateMembers, P.MentionEveryone, P.ManageMessages, P.ViewAuditLog]) {
      expect(whyUnassignable(role({ permissions: P.SendMessages | power }), 10), power.toString()).toBe("dangerous");
    }
  });
});

describe("planToggle", () => {
  const roles = ["a", "b", "c"];

  it("adds a role that isn't held and removes one that is", () => {
    expect(planToggle({ held: new Set(), chosen: ["a"], panelRoleIds: roles, exclusive: false })).toEqual({ add: ["a"], remove: [] });
    expect(planToggle({ held: new Set(["a"]), chosen: ["a"], panelRoleIds: roles, exclusive: false })).toEqual({ add: [], remove: ["a"] });
  });

  it("handles several chosen at once and ignores roles that aren't on the panel", () => {
    expect(planToggle({ held: new Set(["b"]), chosen: ["a", "b", "zzz"], panelRoleIds: roles, exclusive: false })).toEqual({ add: ["a"], remove: ["b"] });
  });

  it("on an exclusive panel keeps at most one", () => {
    expect(planToggle({ held: new Set(["a"]), chosen: ["b"], panelRoleIds: roles, exclusive: true })).toEqual({ add: ["b"], remove: ["a"] });
    expect(planToggle({ held: new Set(["a"]), chosen: ["a"], panelRoleIds: roles, exclusive: true })).toEqual({ add: [], remove: ["a"] });
    expect(planToggle({ held: new Set(["a", "c"]), chosen: ["b"], panelRoleIds: roles, exclusive: true }).remove.sort()).toEqual(["a", "c"]);
    expect(planToggle({ held: new Set(), chosen: [], panelRoleIds: roles, exclusive: true })).toEqual({ add: [], remove: [] });
  });

  it("never touches roles outside the panel", () => {
    expect(planToggle({ held: new Set(["other"]), chosen: ["b"], panelRoleIds: roles, exclusive: true })).toEqual({ add: ["b"], remove: [] });
  });
});

describe("custom ids", () => {
  it("round-trips and rejects anything else", () => {
    const id = buttonId("cm1abc2def3ghi", "123456789012345678");
    expect(parsePanelCustomId(id)).toEqual({ panelId: "cm1abc2def3ghi", roleId: "123456789012345678" });
    expect(parsePanelCustomId("rp:cm1abc2def3ghi")).toEqual({ panelId: "cm1abc2def3ghi", roleId: null });
    for (const bad of ["rp:", "rp:short", "tv:cm1abc2def3ghi", "rp:cm1abc2def3ghi:abc", "rp:cm1abc2def3ghi:123456789012345678:x", "rp:CM1ABC2DEF3GHI"]) {
      expect(parsePanelCustomId(bad), bad).toBeNull();
    }
  });
});

describe("buildPanelMessage", () => {
  const panel = (n: number, over: Partial<PanelView> = {}): PanelView => ({
    id: "cm1abc2def3ghi",
    title: "Pick your roles",
    description: "Hello",
    color: 0x00ffa8,
    imageUrl: "",
    style: "buttons",
    exclusive: false,
    roles: Array.from({ length: n }, (_, i) => ({ roleId: `${100000000000000000 + i}`, label: `Role ${i}`, emoji: "", description: "" })),
    ...over,
  });

  it("lays buttons out five to a row, up to 25", () => {
    const m = buildPanelMessage(panel(12));
    expect(m.components.map((r) => r.components.length)).toEqual([5, 5, 2]);
    expect(buildPanelMessage(panel(25)).components).toHaveLength(5);
  });

  it("builds a menu with one option per role and a single choice when exclusive", () => {
    const m = buildPanelMessage(panel(4, { style: "menu", exclusive: true }));
    expect(m.components).toHaveLength(1);
    const menu = m.components[0]!.toJSON().components[0] as { options: unknown[]; max_values: number };
    expect(menu.options).toHaveLength(4);
    expect(menu.max_values).toBe(1);
  });

  it("shows the picture only when it is a good https address", () => {
    expect(buildPanelMessage(panel(2, { imageUrl: "https://cdn.example.com/p.png" })).embeds[0]!.toJSON().image?.url).toBe("https://cdn.example.com/p.png");
    expect(buildPanelMessage(panel(2, { imageUrl: "http://cdn.example.com/p.png" })).embeds[0]!.toJSON().image).toBeUndefined();
    expect(buildPanelMessage(panel(2)).embeds[0]!.toJSON().image).toBeUndefined();
  });

  it("allows no mentions", () => {
    expect(buildPanelMessage(panel(2)).allowedMentions).toEqual({ parse: [] });
  });
});

describe("rolePanelInput", () => {
  const base = {
    channelId: "123456789012345678",
    title: "Roles",
    description: "",
    color: 0x00ffa8,
    imageUrl: "",
    style: "buttons" as const,
    exclusive: false,
    roles: [{ roleId: "111111111111111111", label: "Gamer", emoji: "🎮", description: "" }],
    publish: false,
  };
  const parse = (over: Record<string, unknown>) => rolePanelInput.safeParse({ ...base, ...over });

  it("accepts a normal panel", () => {
    expect(parse({}).success).toBe(true);
  });

  it("needs a title or text, and 1 to 25 different roles", () => {
    expect(parse({ title: "", description: "" }).success).toBe(false);
    expect(parse({ roles: [] }).success).toBe(false);
    const many = Array.from({ length: 26 }, (_, i) => ({ roleId: `${100000000000000000 + i}`, label: "x", emoji: "", description: "" }));
    expect(parse({ roles: many }).success).toBe(false);
    expect(parse({ roles: [base.roles[0], base.roles[0]] }).success).toBe(false);
  });

  it("takes an optional https picture", () => {
    expect(parse({ imageUrl: "https://cdn.example.com/panel.png" }).success).toBe(true);
    for (const bad of ["http://a.com/x.png", "javascript:alert(1)", "https://u:p@a.com/x", "https://a.com/a b"]) expect(parse({ imageUrl: bad }).success, bad).toBe(false);
  });

  it("only takes unicode emoji", () => {
    for (const ok of ["", "🎮", "👍🏽", "🇦🇹", "1️⃣"]) expect(isUnicodeEmoji(ok), ok).toBe(true);
    for (const bad of ["<:name:123456789012345678>", "abc", ":smile:", "🎮🎮🎮🎮🎮🎮🎮🎮🎮🎮🎮🎮🎮🎮🎮🎮🎮"]) expect(isUnicodeEmoji(bad), bad).toBe(false);
  });
});
