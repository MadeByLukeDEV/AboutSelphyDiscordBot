import { describe, expect, it } from "vitest";
import { FEATURE_GROUPS } from "@aboutselphy/shared/features";
import en from "./messages/en.json";
import de from "./messages/de.json";

// Every group and item on the public overview needs its texts in both languages.
describe("the feature overview texts", () => {
  for (const [lang, catalog] of [["en", en], ["de", de]] as const) {
    it(`${lang} has a title and text for every group and item`, () => {
      const f = catalog.Features as unknown as { groups: Record<string, { title?: string; intro?: string }>; items: Record<string, { title?: string; body?: string }> };
      for (const g of FEATURE_GROUPS) {
        expect(f.groups[g.id]?.title, `${lang} group ${g.id} title`).toBeTruthy();
        expect(f.groups[g.id]?.intro, `${lang} group ${g.id} intro`).toBeTruthy();
        for (const item of g.items) {
          expect(f.items[item.key]?.title, `${lang} item ${item.key} title`).toBeTruthy();
          expect(f.items[item.key]?.body, `${lang} item ${item.key} body`).toBeTruthy();
        }
      }
    });
  }
});
