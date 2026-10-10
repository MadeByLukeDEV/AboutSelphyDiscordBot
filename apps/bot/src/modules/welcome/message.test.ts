import { describe, expect, it } from "vitest";
import { dmText, goodbyeMessage, renderWelcome, rolesOnJoin, rolesToSnapshot, welcomeMessage, type MemberFacts } from "./message";

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
