import { describe, expect, it } from "vitest";
import { timelineModel } from "./rules";

const start = new Date("2026-11-10T00:00:00Z");
const end = new Date("2026-11-11T00:00:00Z");
const at = (hours: number) => new Date(start.getTime() + hours * 3_600_000);

describe("voters over time", () => {
  it("says nothing for small or short polls", () => {
    expect(timelineModel([{ userId: "1", createdAt: at(1) }], start, end)).toBeNull();
    expect(timelineModel(Array.from({ length: 9 }, (_, i) => ({ userId: String(i), createdAt: at(0.1) })), start, new Date(start.getTime() + 600_000))).toBeNull();
  });
  it("counts each voter once, from their first vote, as a running total", () => {
    const votes = [
      { userId: "a", createdAt: at(0.5) },
      { userId: "a", createdAt: at(20) },
      { userId: "b", createdAt: at(1.5) },
      { userId: "c", createdAt: at(12.5) },
      { userId: "d", createdAt: at(23.5) },
      { userId: "e", createdAt: at(23.9) },
    ];
    const t = timelineModel(votes, start, end)!;
    expect(t.points).toHaveLength(24);
    expect(t.points[0]).toBe(1);
    expect(t.points[1]).toBe(2);
    expect(t.points[12]).toBe(3);
    expect(t.points[23]).toBe(5);
    expect([...t.points].sort((x, y) => x - y)).toEqual(t.points);
  });
  it("keeps votes outside the window inside it", () => {
    const early = Array.from({ length: 5 }, (_, i) => ({ userId: String(i), createdAt: new Date(start.getTime() - 5_000_000) }));
    expect(timelineModel(early, start, end)!.points[0]).toBe(5);
  });
});
