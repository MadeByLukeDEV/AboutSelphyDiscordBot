import { describe, expect, it } from "vitest";
import { MODULE_KEYS, MODULES, moduleOfCommand, moduleOfPrefix } from "@aboutselphy/shared/modules";

describe("module table", () => {
  it("maps commands and prefixes to their module", () => {
    expect(moduleOfCommand("poll")).toBe("polls");
    expect(moduleOfCommand("tags")).toBe("customcommands");
    expect(moduleOfCommand("voice")).toBe("tempvoice");
    expect(moduleOfPrefix("tk")).toBe("tickets");
    expect(moduleOfPrefix("rp")).toBe("roles");
  });

  it("never switches off moderation, help or ping", () => {
    for (const name of ["warn", "ban", "timeout", "kick", "purge", "case", "modlog", "help", "ping", "twitch"]) expect(moduleOfCommand(name), name).toBeNull();
    expect(moduleOfPrefix("zz")).toBeNull();
  });

  it("gives every command and prefix to exactly one module", () => {
    const commands = MODULE_KEYS.flatMap((k) => MODULES[k].commands);
    const prefixes = MODULE_KEYS.flatMap((k) => MODULES[k].prefixes);
    expect(new Set(commands).size).toBe(commands.length);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
