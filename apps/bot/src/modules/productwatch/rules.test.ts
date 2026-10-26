import { describe, expect, it } from "vitest";
import { parseProductUrl } from "@aboutselphy/shared/productwatch";
import { changeText, diffSnapshots, formatPrice, parseProductJs, readSnapshot, type Snapshot } from "./rules";

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ title: "Gown", variants: [{ title: "Columbina", price: 9999900, available: true }], image: null, ...over });

describe("parseProductUrl", () => {
  it("cleans a product link, keeps the language prefix and drops tracking parameters", () => {
    const r = parseProductUrl("https://uwowocosplay.com/en-at/products/Some-Gown-S-3XL?pr_prod_strat=similar&pr_seq=uniform#x");
    expect(r?.pageUrl).toBe("https://uwowocosplay.com/en-at/products/some-gown-s-3xl");
    expect(r?.jsUrl).toBe("https://uwowocosplay.com/en-at/products/some-gown-s-3xl.js");
  });
  it("refuses anything that is not an https product page", () => {
    expect(parseProductUrl("http://shop.com/products/x")).toBeNull();
    expect(parseProductUrl("https://shop.com/collections/all")).toBeNull();
    expect(parseProductUrl("https://user:pw@shop.com/products/x")).toBeNull();
    expect(parseProductUrl("https://shop.com/products/x/../../admin")).toBeNull();
    expect(parseProductUrl("https://localhost/products/x")).toBeNull();
    expect(parseProductUrl("not a url")).toBeNull();
  });
});

describe("parseProductJs", () => {
  it("reads the shop's product data and only trusts the shop's own picture host", () => {
    const body = JSON.stringify({ title: "Gown", featured_image: "//cdn.shopify.com/s/files/a.jpg", variants: [{ title: "A", price: 100, available: true }] });
    expect(parseProductJs(body)).toEqual({ title: "Gown", image: "https://cdn.shopify.com/s/files/a.jpg", variants: [{ title: "A", price: 100, available: true }] });
    expect(parseProductJs(JSON.stringify({ title: "G", featured_image: "https://evil.example/a.jpg", variants: [{ title: "A", price: 1, available: false }] }))?.image).toBeNull();
  });
  it("rejects anything that is not a product", () => {
    expect(parseProductJs("<html>blocked</html>")).toBeNull();
    expect(parseProductJs("{}")).toBeNull();
    expect(parseProductJs(JSON.stringify({ title: "G", variants: [] }))).toBeNull();
  });
});

describe("diffSnapshots", () => {
  it("finds nothing when nothing changed", () => {
    expect(diffSnapshots(snap(), snap())).toEqual([]);
  });
  it("finds a price, stock, name and option change", () => {
    const after = snap({ title: "Gown v2", variants: [{ title: "Columbina", price: 14900, available: false }, { title: "Extra", price: 100, available: true }] });
    expect(diffSnapshots(snap(), after)).toEqual([
      { kind: "title", from: "Gown", to: "Gown v2" },
      { kind: "price", variant: "Columbina", from: 9999900, to: 14900 },
      { kind: "stock", variant: "Columbina", available: false },
      { kind: "added", variant: "Extra" },
    ]);
    expect(diffSnapshots(snap(), snap({ variants: [] }))).toEqual([{ kind: "removed", variant: "Columbina" }]);
  });
});

describe("messages", () => {
  it("formats prices and writes escaped lines without repeating a single option's name", () => {
    expect(formatPrice(9999900)).toBe("99,999.00");
    const text = changeText([{ kind: "price", variant: "Columbina", from: 9999900, to: 14900 }], true);
    expect(text).toBe("• Price 99,999.00 → **149.00**");
    expect(changeText([{ kind: "stock", variant: "XL", available: true }], false)).toContain("XL: **Available again**");
    expect(changeText([{ kind: "title", from: "a", to: "**bold**" }], true)).not.toContain("****bold****");
  });
  it("cuts a very long list", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ kind: "added" as const, variant: `v${i}` }));
    expect(changeText(many, false)).toContain("and 18 more");
  });
  it("reads a stored snapshot back and refuses a wrong shape", () => {
    expect(readSnapshot(snap())).toEqual(snap());
    expect(readSnapshot({ title: 1 })).toBeNull();
    expect(readSnapshot(null)).toBeNull();
  });
});
