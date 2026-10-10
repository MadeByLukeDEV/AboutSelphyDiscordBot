import { describe, expect, it } from "vitest";
import { welcomeSettingsSchema } from "@aboutselphy/shared/welcome";
import { dmText, goodbyeMessage, pickTemplate, renderWelcome, rolesOnJoin, rolesToSnapshot, welcomeMessage, type MemberFacts } from "./message";

const who: MemberFacts = { id: "123456789012345678", username: "Cool **Guy** <@&999999999999999999>", serverName: "Selphy's [Server]", memberCount: 42 };

describe("renderWelcome", () => {
  it("fills the placeholders, mentions the member, and neutralises names", () => {
    const text = renderWelcome("Hi {user} from {server}, #{count}, {username}", who);
    expect(text).toContain("<@123456789012345678>");
    expect(text).toContain("#42");
    expect(text).toContain("\\*\\*Guy\\*\\*");
    expect(text).toContain("\\[Server\\]");
    expect(text).not.toMatch(/(?<!\\)<@&/);
  });

  it("leaves unknown placeholders alone and can avoid the mention", () => {
    expect(renderWelcome("{nope} {user}", { ...who, username: "bob" }, false)).toBe("{nope} bob");
  });
});

describe("welcomeMessage", () => {
  it("pings only the new member", () => {
    const m = welcomeMessage("Hi {user}", who, { asEmbed: false, color: 0, imageUrl: "" });
    expect(m.allowedMentions).toEqual({ parse: [], users: ["123456789012345678"] });
    expect(m.content).toContain("<@123456789012345678>");
    expect(m.embeds).toHaveLength(0);
  });

  it("as a box keeps a real mention above it, and takes only a good https picture", () => {
    const m = welcomeMessage("Hi {user}", who, { asEmbed: true, color: 0xff0000, imageUrl: "https://cdn.example.com/w.png" });
    expect(m.content).toBe("<@123456789012345678>");
    const json = m.embeds[0]!.toJSON();
    expect(json.color).toBe(0xff0000);
    expect(json.image?.url).toBe("https://cdn.example.com/w.png");
    expect(welcomeMessage("x", who, { asEmbed: true, color: 0, imageUrl: "http://a.com/x.png" }).embeds[0]!.toJSON().image).toBeUndefined();
  });

  it("stays inside Discord's limits", () => {
    const m = welcomeMessage("y".repeat(9000), who, { asEmbed: false, color: 0, imageUrl: "" });
    expect(m.content.length).toBeLessThanOrEqual(2000);
  });
});

describe("dm and goodbye", () => {
  it("never mention anyone", () => {
    expect(dmText("Hi {user}", { ...who, username: "bob" })).toBe("Hi bob");
    const g = goodbyeMessage("{username} left", { ...who, username: "bob" });
    expect(g.content).toBe("bob left");
    expect(g.allowedMentions).toEqual({ parse: [] });
  });
});

describe("roles", () => {
  it("snapshots everything but @everyone and managed roles", () => {
    expect(rolesToSnapshot([{ id: "e", managed: false }, { id: "a", managed: false }, { id: "m", managed: true }], "e")).toEqual(["a"]);
  });

  it("gives auto and restored roles once, skipping what the member has", () => {
    expect(rolesOnJoin({ auto: ["a", "b"], restored: ["b", "c", "d"], already: new Set(["d"]) })).toEqual(["a", "b", "c"]);
  });
});

describe("welcomeSettingsSchema", () => {
  const base = {
    autoRoleIds: [],
    botAutoRoleIds: [],
    restoreRoles: false,
    welcomeEnabled: false,
    welcomeChannelId: "",
    welcomeTemplates: ["Hi {user}"],
    welcomeCardEnabled: false,
    welcomeCardMode: "background",
    welcomeCardTitle: "Welcome",
    welcomeCardSubtitle: "Member #{count}",
    welcomeAsEmbed: true,
    welcomeColor: 0x00ffa8,
    welcomeImageUrl: "",
    dmEnabled: false,
    dmTemplate: "Hi",
    goodbyeEnabled: false,
    goodbyeChannelId: "",
    goodbyeTemplate: "Bye {username}",
  };
  const parse = (over: Record<string, unknown>) => welcomeSettingsSchema.safeParse({ ...base, ...over });
  const role = (i: number) => `1000000000000000${String(i).padStart(2, "0")}`;

  it("accepts the defaults", () => {
    expect(parse({}).success).toBe(true);
  });

  it("needs a channel for a message that is switched on", () => {
    expect(parse({ welcomeEnabled: true }).success).toBe(false);
    expect(parse({ welcomeEnabled: true, welcomeChannelId: "123456789012345678" }).success).toBe(true);
    expect(parse({ goodbyeEnabled: true }).success).toBe(false);
  });

  it("allows at most 5 different auto-roles per list", () => {
    expect(parse({ autoRoleIds: [1, 2, 3, 4, 5].map(role) }).success).toBe(true);
    expect(parse({ autoRoleIds: [1, 2, 3, 4, 5, 6].map(role) }).success).toBe(false);
    expect(parse({ botAutoRoleIds: [role(1), role(1)] }).success).toBe(false);
    expect(parse({ autoRoleIds: ["everyone"] }).success).toBe(false);
  });

  it("takes only a good https picture and a template of sensible size", () => {
    expect(parse({ welcomeImageUrl: "https://cdn.example.com/w.png" }).success).toBe(true);
    expect(parse({ welcomeImageUrl: "http://a.com/x.png" }).success).toBe(false);
    expect(parse({ welcomeTemplates: [""] }).success).toBe(false);
    expect(parse({ welcomeTemplates: ["x".repeat(1001)] }).success).toBe(false);
  });
});

describe("welcome variants and card settings", () => {
  const base = {
    autoRoleIds: [],
    botAutoRoleIds: [],
    restoreRoles: false,
    welcomeEnabled: true,
    welcomeChannelId: "123456789012345678",
    welcomeTemplates: ["a", "b"],
    welcomeAsEmbed: true,
    welcomeColor: 0,
    welcomeImageUrl: "",
    welcomeCardEnabled: true,
    welcomeCardMode: "sticker",
    welcomeCardTitle: "Welcome",
    welcomeCardSubtitle: "Member #{count}",
    dmEnabled: false,
    dmTemplate: "Hi",
    goodbyeEnabled: false,
    goodbyeChannelId: "",
    goodbyeTemplate: "Bye",
  };
  const parse = (over: Record<string, unknown>) => welcomeSettingsSchema.safeParse({ ...base, ...over });

  it("takes up to 10 texts and needs at least one while the welcome is on", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ welcomeTemplates: [] }).success).toBe(false);
    expect(parse({ welcomeEnabled: false, welcomeTemplates: [] }).success).toBe(true);
    expect(parse({ welcomeTemplates: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success).toBe(false);
  });

  it("validates the card options", () => {
    expect(parse({ welcomeCardMode: "tile" }).success).toBe(false);
    expect(parse({ welcomeCardTitle: "" }).success).toBe(false);
    expect(parse({ welcomeCardTitle: "x".repeat(41) }).success).toBe(false);
    expect(parse({ welcomeCardSubtitle: "" }).success).toBe(true);
  });
});

describe("pickTemplate", () => {
  it("returns null for none and the only one for one", () => {
    expect(pickTemplate([], null)).toBeNull();
    expect(pickTemplate(["only"], 0)).toEqual({ index: 0, text: "only" });
  });

  it("never repeats the last one when there is a choice", () => {
    for (let last = 0; last < 3; last++) {
      for (const r of [0, 0.3, 0.6, 0.99]) expect(pickTemplate(["a", "b", "c"], last, () => r)!.index).not.toBe(last);
    }
  });

  it("can reach every other text", () => {
    const seen = new Set([0, 0.5, 0.99].map((r) => pickTemplate(["a", "b", "c"], 0, () => r)!.index));
    expect(seen).toEqual(new Set([1, 2]));
  });
});
