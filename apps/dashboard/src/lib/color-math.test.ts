import { describe, expect, it } from "vitest";
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, rgbToHex } from "./color-math";

describe("normalizeHex", () => {
  it("accepts six hex digits with or without #, any case", () => {
    expect(normalizeHex("#00ffa8")).toBe("#00FFA8");
    expect(normalizeHex("00FFA8")).toBe("#00FFA8");
    expect(normalizeHex("  #abcdef ")).toBe("#ABCDEF");
  });
  it("refuses everything else", () => {
    for (const bad of ["", "#fff", "#12345", "#1234567", "#gggggg", "red", "#00ffa8;x"]) expect(normalizeHex(bad), bad).toBeNull();
  });
});

describe("conversions", () => {
  it("rgb and hex agree", () => {
    expect(hexToRgb("#47FF85")).toEqual({ r: 71, g: 255, b: 133 });
    expect(rgbToHex(71, 255, 133)).toBe("#47FF85");
    expect(rgbToHex(-5, 300, 12.4)).toBe("#00FF0C");
  });
  it("hsv of the primaries", () => {
    expect(hexToHsv("#FF0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00FF00").h).toBe(120);
    expect(hexToHsv("#0000FF").h).toBe(240);
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv("#FFFFFF")).toEqual({ h: 0, s: 0, v: 1 });
  });
  it("round-trips any colour back to the same hex", () => {
    for (const hex of ["#00FFA8", "#9146FF", "#FF4757", "#99AAB5", "#123456", "#FEDCBA", "#808080", "#010203"]) expect(hsvToHex(hexToHsv(hex)), hex).toBe(hex);
  });
  it("wraps and clamps its inputs", () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe("#FF0000");
    expect(hsvToHex({ h: -120, s: 1, v: 1 })).toBe("#0000FF");
    expect(hsvToHex({ h: 10, s: 5, v: 9 })).toBe(hsvToHex({ h: 10, s: 1, v: 1 }));
  });
});
