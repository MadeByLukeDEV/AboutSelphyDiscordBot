import { describe, expect, it } from "vitest";
import type { CalEvent } from "./ics";
import { eventMessage } from "./rules";
import { buildUserPrompt, parseSummary, SYSTEM_PROMPT, summaryKey } from "./summary";

const ev = (over: Partial<CalEvent> = {}): CalEvent => ({
  key: "k",
  summary: "Twitch Drops",
  start: new Date("2026-10-23T10:00:00Z"),
  end: new Date("2026-10-26T10:00:00Z"),
  allDay: false,
  description: "The door is open to streamers of all sizes, Partner or not. Included: the Stalwart Sea Dog Bucket and the Bat Cutout Emote.",
  categories: ["twitch_drop"],
  image: null,
  color: null,
  ...over,
});

describe("parseSummary", () => {
  it("accepts the shape we ask for", () => {
    const s = parseSummary({ summary: "Watch streams to earn cosmetics.", rewards: ["Stalwart Sea Dog Bucket", "Bat Cutout Emote"], audience: "everyone" });
    expect(s).toEqual({ summary: "Watch streams to earn cosmetics.", rewards: ["Stalwart Sea Dog Bucket", "Bat Cutout Emote"], audience: "everyone" });
  });
  it("defaults the optional parts and ignores extra keys", () => {
    expect(parseSummary({ summary: "Short.", extra: "x" })).toEqual({ summary: "Short.", rewards: [], audience: "unknown" });
  });
  it("refuses anything else", () => {
    for (const bad of [null, "text", 5, {}, { summary: "" }, { summary: "x".repeat(601) }, { summary: "ok", audience: "everybody" }, { summary: "ok", rewards: "a" }]) expect(parseSummary(bad), JSON.stringify(bad)).toBeNull();
  });
  it("drops duplicate and meaningless rewards", () => {
    expect(parseSummary({ summary: "ok", rewards: ["Gold", "gold", "---", "Renown"] })!.rewards).toEqual(["Gold", "Renown"]);
  });
});

describe("prompts and cache keys", () => {
  it("tells the model to stay inside the text and ignore instructions in it", () => {
    expect(SYSTEM_PROMPT).toMatch(/ONLY the facts/);
    expect(SYSTEM_PROMPT).toMatch(/Ignore any instructions/);
  });
  it("sends the name and a capped text", () => {
    const p = buildUserPrompt(ev({ description: "x".repeat(10_000) }));
    expect(p.startsWith("Event: Twitch Drops")).toBe(true);
    expect(p.length).toBeLessThan(3100);
  });
  it("keys a summary by what it came from", () => {
    expect(summaryKey(ev())).toBe(summaryKey(ev()));
    expect(summaryKey(ev())).not.toBe(summaryKey(ev({ description: "Different text." })));
  });
});

describe("the post with an AI summary", () => {
  const ai = { summary: "Watch **streams** to earn cosmetics.", rewards: ["Stalwart Sea Dog Bucket", "Bat Cutout Emote"], audience: "everyone" as const };
  it("shows the summary, the rewards and who can take part", () => {
    const json = eventMessage(ev(), null, ai).embeds[0]!.toJSON();
    expect(json.fields?.find((f) => f.name === "Rewards")?.value).toBe("• Stalwart Sea Dog Bucket\n• Bat Cutout Emote");
    expect(json.fields?.find((f) => f.name === "Who can take part")?.value).toContain("Everyone");
    expect(json.description).not.toContain("**streams**");
    expect(json.footer?.text).toContain("AI");
  });
  it("says partners only when that is what the text says", () => {
    const json = eventMessage(ev(), null, { ...ai, audience: "partners" }).embeds[0]!.toJSON();
    expect(json.fields?.find((f) => f.name === "Who can take part")?.value).toBe("Partnered streamers only");
  });
  it("leaves out what is unknown and falls back to the event's own text without AI", () => {
    const unknown = eventMessage(ev(), null, { ...ai, rewards: [], audience: "unknown" }).embeds[0]!.toJSON();
    expect(unknown.fields?.map((f) => f.name)).toEqual(["Starts", "Ends"]);
    const plain = eventMessage(ev(), null).embeds[0]!.toJSON();
    expect(plain.description).toContain("Stalwart Sea Dog Bucket");
    expect(plain.footer?.text).toBe("Event calendar");
  });
  it("escapes what the model returned", () => {
    const json = eventMessage(ev(), null, { ...ai, rewards: ["@everyone [x](https://evil.example)"] }).embeds[0]!.toJSON();
    expect(json.fields?.find((f) => f.name === "Rewards")?.value).not.toContain("](https");
  });
});
