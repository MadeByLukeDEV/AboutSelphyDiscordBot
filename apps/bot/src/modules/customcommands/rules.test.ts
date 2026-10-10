import { describe, expect, it } from "vitest";
import { COMMAND_NAME_PATTERN, customCommandInput, normalizeCommandName } from "@aboutselphy/shared/custom-commands";
import { renderCommandText, suggestNames } from "./rules";

describe("command names", () => {
  it("are tidied and then must match the pattern", () => {
    expect(normalizeCommandName("  Server Rules ")).toBe("server-rules");
    for (const ok of ["rules", "a", "faq_2", "my-tag", "0day"]) expect(COMMAND_NAME_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ["", "-x", "_x", "has space", "UPPER", "x".repeat(33), "emoji😀", "a/b"]) expect(COMMAND_NAME_PATTERN.test(bad), bad).toBe(false);
  });

  it("customCommandInput normalises the name and refuses an unusable one", () => {
    const base = { response: "Be kind.", ephemeral: false, enabled: true };
    expect(customCommandInput.parse({ ...base, name: " Server Rules " }).name).toBe("server-rules");
    expect(customCommandInput.safeParse({ ...base, name: "no/slash" }).success).toBe(false);
    expect(customCommandInput.safeParse({ ...base, name: "ok", response: "  " }).success).toBe(false);
    expect(customCommandInput.safeParse({ ...base, name: "ok", response: "x".repeat(1801) }).success).toBe(false);
  });
});

describe("renderCommandText", () => {
  const who = { id: "111111111111111111", username: "Se*lphy", server: "About_Selphy" };
  it("mentions the asker and escapes the plain variables", () => {
    const text = renderCommandText("Hi {user}, welcome to {server}! {username}", who);
    expect(text).toContain("<@111111111111111111>");
    expect(text).toContain("About\\_Selphy");
    expect(text).toContain("Se\\*lphy");
  });

  it("keeps staff markdown", () => expect(renderCommandText("**Rules**\n- be kind", who)).toBe("**Rules**\n- be kind"));
  it("stays within Discord's message limit", () => expect(renderCommandText("x".repeat(5000), who).length).toBeLessThanOrEqual(2000));
});

describe("suggestNames", () => {
  const names = ["rules", "faq", "ruleset", "partner-rules", "help"];
  it("lists names starting with the text first, then ones containing it", () => {
    expect(suggestNames(names, "rule").map((s) => s.name)).toEqual(["rules", "ruleset", "partner-rules"]);
    expect(suggestNames(names, "").length).toBe(5);
    expect(suggestNames(names, "zzz")).toEqual([]);
  });

  it("returns at most 25", () => expect(suggestNames(Array.from({ length: 80 }, (_, i) => `tag${i}`), "tag").length).toBe(25));
});
