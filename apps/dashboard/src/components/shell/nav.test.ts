import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { navFor } from "./nav";

const messages = (lang: string) => JSON.parse(readFileSync(resolve(__dirname, `../../modules/i18n/messages/${lang}.json`), "utf8")) as { Shell: { nav: { groups: Record<string, string>; items: Record<string, string> } } };

describe("navigation", () => {
  const admin = navFor(true);
  const moderator = navFor(false);
  const flat = (groups: ReturnType<typeof navFor>) => groups.flatMap((g) => g.items);

  it("lists every page exactly once", () => {
    const items = flat(admin);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.label)).size).toBe(items.length);
  });

  it("starts with the overview alone, and every other group has a heading and several pages or a clear purpose", () => {
    expect(admin[0]).toEqual({ label: null, items: [{ href: "/", label: "overview" }] });
    for (const g of admin.slice(1)) {
      expect(g.label, "heading").not.toBeNull();
      expect(g.items.length, String(g.label)).toBeGreaterThanOrEqual(2);
      expect(g.items.length, `${g.label} would be too long to scan`).toBeLessThanOrEqual(7);
    }
  });

  it("shows moderators only what they may use, and never an empty group", () => {
    const mine = flat(moderator).map((i) => i.href);
    expect(mine).toEqual(["/", "/cases", "/members", "/invites", "/tickets", "/giveaways", "/polls", "/suggestions", "/announcements"]);
    for (const g of moderator) expect(g.items.length).toBeGreaterThan(0);
    // Admins see a superset, in the same order.
    const all = flat(admin).map((i) => i.href);
    expect(all.filter((h) => mine.includes(h))).toEqual(mine);
  });

  it("has a name for every group and page in English and German", () => {
    for (const lang of ["en", "de"]) {
      const nav = messages(lang).Shell.nav;
      for (const g of admin) if (g.label) expect(nav.groups[g.label], `${lang} group ${g.label}`).toBeTruthy();
      for (const i of flat(admin)) expect(nav.items[i.label], `${lang} item ${i.label}`).toBeTruthy();
    }
  });
});
