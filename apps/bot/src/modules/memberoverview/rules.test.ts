import { describe, expect, it } from "vitest";
import type { MemberOverviewPayload } from "@aboutselphy/shared/memberoverview";
import { buildEmbeds, itemValue, MAX_EMBEDS, overviewPages, TEXT_BUDGET } from "./rules";

const item = (n: number, body = "A short explanation of the feature.") => ({ title: `Feature ${n}`, body, commands: ["/one", "/two"] });
const payload = (groups = 3, items = 3): MemberOverviewPayload => ({
  title: "What can the bot do?",
  intro: "Everything for members.",
  url: "https://bot.example.com/features",
  footer: "Moderators have more tools.",
  groups: Array.from({ length: groups }, (_, g) => ({ title: `Group ${g}`, intro: "About this group.", items: Array.from({ length: items }, (_, i) => item(i)) })),
});

describe("the item field", () => {
  it("shows the text and the commands in code style", () => {
    expect(itemValue("Text.", ["/rank", "/leaderboard"])).toBe("Text.\n`/rank` `/leaderboard`");
    expect(itemValue("Text.", [])).toBe("Text.");
  });
  it("stays within the field limit even with a long text", () => {
    expect(itemValue("x".repeat(3000), ["/a", "/b", "/c"]).length).toBeLessThanOrEqual(1024);
  });
});

describe("the embeds", () => {
  it("has a header, one embed per group and the footer on the last", () => {
    const built = buildEmbeds(payload(), "#00FFA8");
    expect(built).toHaveLength(4);
    expect(built[0]!.embed.toJSON().url).toBe("https://bot.example.com/features");
    expect(built[3]!.embed.toJSON().footer?.text).toBe("Moderators have more tools.");
    expect(built[1]!.embed.toJSON().fields).toHaveLength(3);
  });
  it("uses the colour", () => {
    expect(buildEmbeds(payload(), "#FF0000")[0]!.embed.toJSON().color).toBe(0xff0000);
    expect(buildEmbeds(payload(), "bad")[0]!.embed.toJSON().color).toBe(0x00ffa8);
  });
});

describe("packing into messages", () => {
  it("keeps a small overview in one message", () => {
    expect(overviewPages(payload(3, 3), "#00FFA8")).toHaveLength(1);
  });
  it("splits a big one without breaking Discord's limits or the order", () => {
    const pages = overviewPages(payload(12, 12), "#00FFA8");
    expect(pages.length).toBeGreaterThan(1);
    let count = 0;
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(MAX_EMBEDS);
      const chars = page.reduce((n, e) => {
        const j = e.toJSON();
        return n + (j.title?.length ?? 0) + (j.description?.length ?? 0) + (j.footer?.text.length ?? 0) + (j.fields ?? []).reduce((m, f) => m + f.name.length + f.value.length, 0);
      }, 0);
      expect(chars).toBeLessThanOrEqual(6000);
      count += page.length;
    }
    expect(count).toBe(13);
    expect(TEXT_BUDGET).toBeLessThan(6000);
  });
});
