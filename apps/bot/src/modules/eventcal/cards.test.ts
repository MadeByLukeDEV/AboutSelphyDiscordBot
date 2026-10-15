import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { dateRangeText, eventCardLayout, kindLabel, renderEventCard, renderMonthlyCard, weeklyText, wrapLines } from "./cards";

const measure = (t: string) => t.length * 10;

describe("wrapping text", () => {
  it("breaks at spaces and keeps every line within the width", () => {
    const lines = wrapLines(measure, "one two three four five six", 100, 5);
    expect(lines).toEqual(["one two", "three four", "five six"]);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(100);
  });
  it("ends the last line with an ellipsis when text was cut", () => {
    const lines = wrapLines(measure, "alpha beta gamma delta epsilon zeta eta theta", 100, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(100);
  });
  it("cuts a word that is wider than a line and survives empty text", () => {
    const lines = wrapLines(measure, "x".repeat(40), 100, 5);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(100);
    expect(lines.length).toBeGreaterThan(1);
    expect(wrapLines(measure, "   ", 100, 3)).toEqual([]);
  });
});

describe("dates and labels", () => {
  it("writes a range, a single day and a timed event", () => {
    expect(dateRangeText(new Date("2026-10-23T00:00:00Z"), new Date("2026-10-26T00:00:00Z"), true)).toBe("Oct 23 – Oct 26, 2026");
    expect(dateRangeText(new Date("2026-10-22T00:00:00Z"), null, true)).toBe("Oct 22, 2026");
    expect(dateRangeText(new Date("2026-10-22T09:30:00Z"), new Date("2026-10-22T11:00:00Z"), false)).toBe("Oct 22, 2026 · 09:30 UTC");
    // A timed event that ends at midnight ends on the day before.
    expect(dateRangeText(new Date("2026-10-23T10:00:00Z"), new Date("2026-10-26T00:00:00Z"), false)).toBe("Oct 23 – Oct 25, 2026");
  });
  it("names kinds and weekdays", () => {
    expect(kindLabel("drop")).toBe("DROPS");
    expect(kindLabel("nonsense")).toBe("EVENT");
    expect(weeklyText(2)).toBe("Every Tuesday");
  });
});

describe("card layout", () => {
  it("is taller with more item rows and never shorter than the minimum", () => {
    expect(eventCardLayout(0, 0, 1).height).toBeGreaterThanOrEqual(300);
    const one = eventCardLayout(4, 2, 1);
    const two = eventCardLayout(8, 2, 1);
    expect(two.height).toBeGreaterThan(one.height);
    expect(one.cols).toBe(4);
    expect(eventCardLayout(2, 0, 1).cols).toBe(2);
  });
  it("shows at most twelve items", () => {
    expect(eventCardLayout(40, 0, 1).rows).toBe(3);
  });
});

const png = (size: number): Buffer => {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c0a060";
  ctx.fillRect(0, 0, size, size);
  return c.toBuffer("image/png");
};

const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

describe("drawing", () => {
  it("draws a drop card with item pictures, a missing picture and a bad one", async () => {
    const out = await renderEventCard({
      title: "Twitch Drops during the Season 21 Community Weekend",
      kind: "drop",
      dateText: "Oct 23 – Oct 26, 2026",
      summary: "Watch any Sea of Thieves streamer to unlock the rewards on offer.",
      items: [
        { name: "Stalwart Sea Dog Bucket", image: png(128) },
        { name: "Gilded Phoenix Wheel", image: null },
        { name: "Tiny picture", image: png(16) }, // under the size limit: drawn as initials
        { name: "Not a picture", image: Buffer.from("hello") },
        { name: "Bat Cutout Emote", image: png(100) },
      ],
      theme: { accent: "#00ffa8", background: null },
    });
    expect(isPng(out)).toBe(true);
    expect(out.length).toBeGreaterThan(5000);
  });
  it("draws an event card without items, on a background picture", async () => {
    const out = await renderEventCard({ title: "Festival of the Damned", kind: "event", dateText: "Oct 27 – Nov 3, 2026", summary: "", items: [], theme: { accent: "#ff5577", background: png(512) } });
    expect(isPng(out)).toBe(true);
  });
  it("draws the monthly overview, also with more rows than fit", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ title: `Event number ${i + 1}`, when: "Oct 1 – Oct 3, 2026", kind: "event", blurb: "A short line about the event." }));
    const out = await renderMonthlyCard({ title: "October 2026", subtitle: "Sea of Thieves", rows, theme: { accent: "#00ffa8", background: null } });
    expect(isPng(out)).toBe(true);
    const empty = await renderMonthlyCard({ title: "November 2026", subtitle: "Sea of Thieves", rows: [], theme: { accent: "#00ffa8", background: null } });
    expect(isPng(empty)).toBe(true);
  });
});
