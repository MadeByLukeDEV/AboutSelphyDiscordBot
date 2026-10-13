import { describe, expect, it } from "vitest";
import { afkLine } from "./afk";
import { buildStaffEmbed, parseHexColor } from "./embed";

describe("parseHexColor", () => {
  it("reads six hex digits with or without #", () => {
    expect(parseHexColor("#00ffa8")).toBe(0x00ffa8);
    expect(parseHexColor("FF0000")).toBe(0xff0000);
  });
  it("refuses anything else", () => {
    for (const bad of ["", "#fff", "red", "#gggggg", "#00ffa8ff"]) expect(parseHexColor(bad), bad).toBeNull();
  });
});

describe("buildStaffEmbed", () => {
  const base = { title: "", description: "", color: "", image: "", footer: "" };
  it("needs a title or a description", () => {
    expect(typeof buildStaffEmbed(base)).toBe("string");
    expect(typeof buildStaffEmbed({ ...base, title: "Hi" })).toBe("object");
  });
  it("turns \\n into line breaks and keeps staff markdown", () => {
    const e = buildStaffEmbed({ ...base, description: "**one**\\ntwo" });
    expect(typeof e).toBe("object");
    if (typeof e !== "string") expect(e.toJSON().description).toBe("**one**\ntwo");
  });
  it("refuses a bad colour and a non-https picture", () => {
    expect(buildStaffEmbed({ ...base, title: "x", color: "nope" })).toMatch(/hex/);
    expect(buildStaffEmbed({ ...base, title: "x", image: "http://a.example/x.png" })).toMatch(/https/);
    expect(typeof buildStaffEmbed({ ...base, title: "x", image: "https://a.example/x.png" })).toBe("object");
  });
});

describe("afkLine", () => {
  it("escapes the reason and shows the time", () => {
    const line = afkLine("123", "**gone** @everyone", new Date("2026-11-08T10:00:00Z"));
    expect(line).toContain("<@123> is AFK: ");
    expect(line).not.toContain("**gone**");
    expect(line).toMatch(/<t:\d+:R>/);
  });
  it("has no reason part without one", () => {
    expect(afkLine("123", "  ", new Date())).toMatch(/^<@123> is AFK \(since/);
  });
});
