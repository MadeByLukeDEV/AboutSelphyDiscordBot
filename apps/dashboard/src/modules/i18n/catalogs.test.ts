import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const load = (lang: string) => JSON.parse(readFileSync(resolve(__dirname, `messages/${lang}.json`), "utf8")) as Record<string, unknown>;

/** Every key path in a catalog, e.g. "Webhooks.events.mod_case". */
function paths(node: unknown, prefix = ""): string[] {
  if (!node || typeof node !== "object" || Array.isArray(node)) return [prefix];
  return Object.entries(node).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}

describe("message catalogs", () => {
  const en = load("en");
  const de = load("de");

  it("have no key containing a dot (next-intl reads a dot as nesting and refuses the whole catalog)", () => {
    const bad: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      for (const [k, v] of Object.entries(node)) {
        if (k.includes(".")) bad.push(`${path}/${k}`);
        walk(v, `${path}/${k}`);
      }
    };
    walk(en, "en");
    walk(de, "de");
    expect(bad).toEqual([]);
  });

  it("have exactly the same keys in English and German", () => {
    const a = new Set(paths(en));
    const b = new Set(paths(de));
    expect([...a].filter((k) => !b.has(k)), "only in English").toEqual([]);
    expect([...b].filter((k) => !a.has(k)), "only in German").toEqual([]);
  });
});
