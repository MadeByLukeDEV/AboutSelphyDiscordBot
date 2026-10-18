import { describe, expect, it } from "vitest";
import { commandNameOf, FEATURE_GROUPS } from "@aboutselphy/shared/features";
import { COMMANDS } from "./index";

// The public "what can the bot do" page must mention every command a member can use, and must not name commands that don't exist.
describe("the public feature overview", () => {
  const listed = new Set(FEATURE_GROUPS.flatMap((g) => g.items.flatMap((i) => i.commands.map(commandNameOf))));
  const real = new Set(COMMANDS.map((c) => c.data.name));
  // Team-only even though no staff level is set in code (it checks inside).
  const teamOnly = new Set(["ticket"]);

  it("mentions every command members can use", () => {
    const missing = COMMANDS.filter((c) => !c.requires && !teamOnly.has(c.data.name) && !listed.has(c.data.name)).map((c) => `/${c.data.name}`);
    expect(missing).toEqual([]);
  });
  it("names only commands that exist", () => {
    const unknown = [...listed].filter((name) => !real.has(name));
    expect(unknown).toEqual([]);
  });
  it("lists no staff command", () => {
    const staff = COMMANDS.filter((c) => c.requires).map((c) => c.data.name);
    expect([...listed].filter((name) => staff.includes(name))).toEqual([]);
  });
  it("has unique item keys", () => {
    const keys = FEATURE_GROUPS.flatMap((g) => g.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
