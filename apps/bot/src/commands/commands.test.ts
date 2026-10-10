import { describe, expect, it } from "vitest";
import { COMMANDS } from "./index";

// Importing COMMANDS runs every builder's toJSON(), which validates the
// definition (Discord rejects the whole registration if one command is bad).
describe("slash command definitions", () => {
  it("has unique, valid names", () => {
    const names = COMMANDS.map((c) => c.data.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[\w-]{1,32}$/);
    expect(COMMANDS.length).toBeLessThanOrEqual(100);
  });

  it("puts required options before optional ones (Discord rejects the reverse)", () => {
    for (const c of COMMANDS) {
      const options = (c.data.options ?? []).filter((o) => o.type !== 1 && o.type !== 2); // not (sub)commands
      let seenOptional = false;
      for (const o of options) {
        if (!o.required) seenOptional = true;
        else expect(seenOptional, `${c.data.name}.${o.name}`).toBe(false);
      }
    }
  });

  it("has a staff requirement on every moderation command (enforced in code, not only by Discord)", () => {
    const moderation = ["warn", "timeout", "untimeout", "kick", "ban", "unban", "note", "case", "infractions", "modlog"];
    for (const name of moderation) {
      const command = COMMANDS.find((c) => c.data.name === name);
      expect(command, name).toBeDefined();
      expect(command!.requires, name).toBeDefined();
    }
    expect(COMMANDS.find((c) => c.data.name === "modlog")!.requires).toBe("admin");
  });

  it("keeps /tempvoice admin-only", () => {
    expect(COMMANDS.find((c) => c.data.name === "tempvoice")!.requires).toBe("admin");
  });

  it("leaves /voice open to every member: acting on someone's own room is checked in the controller, not by hiding the command", () => {
    const voice = COMMANDS.find((c) => c.data.name === "voice");
    expect(voice).toBeDefined();
    expect(voice!.requires).toBeUndefined();
    // No default_member_permissions: Discord would hide the command from members who lack them.
    expect(voice!.data.default_member_permissions ?? null).toBeNull();
  });

  it("is guild-only", () => {
    for (const c of COMMANDS) expect(c.data.contexts, c.data.name).toEqual([0]);
  });
});
