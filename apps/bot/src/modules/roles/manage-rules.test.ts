import { PermissionFlagsBits as P } from "discord.js";
import { describe, expect, it } from "vitest";
import { isPowerful, protectionOf, type ManageFacts } from "./manage-rules";

const base: ManageFacts = { id: "222222222222222222", guildId: "111111111111111111", managed: false, position: 3, permissions: 0n };
const none = new Set<string>();

describe("protectionOf", () => {
  it("lets an ordinary role below the bot go", () => expect(protectionOf(base, 10, none)).toBeNull());

  it("refuses integration-managed roles", () => expect(protectionOf({ ...base, managed: true }, 10, none)).toBe("managed"));

  it("refuses roles at or above the bot's top role", () => {
    expect(protectionOf({ ...base, position: 10 }, 10, none)).toBe("aboveBot");
    expect(protectionOf({ ...base, position: 11 }, 10, none)).toBe("aboveBot");
    expect(protectionOf({ ...base, position: 9 }, 10, none)).toBeNull();
  });

  it("refuses the staff roles from the environment", () => expect(protectionOf(base, 10, new Set([base.id]))).toBe("staff"));

  it("checks managed first, then position, then staff", () => {
    expect(protectionOf({ ...base, managed: true, position: 50 }, 10, new Set([base.id]))).toBe("managed");
    expect(protectionOf({ ...base, position: 50 }, 10, new Set([base.id]))).toBe("aboveBot");
  });
});

describe("isPowerful", () => {
  it("flags permissions that change the server or other members", () => {
    expect(isPowerful(P.BanMembers)).toBe(true);
    expect(isPowerful(P.Administrator | P.SendMessages)).toBe(true);
    expect(isPowerful(P.SendMessages | P.ViewChannel)).toBe(false);
    expect(isPowerful(0n)).toBe(false);
  });
});
