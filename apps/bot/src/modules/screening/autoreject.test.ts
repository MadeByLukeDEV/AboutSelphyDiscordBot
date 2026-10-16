import { describe, expect, it } from "vitest";
import { waitedTooLong } from "./rules";

describe("waiting too long", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("is never true when the limit is off", () => {
    expect(waitedTooLong(new Date("2020-01-01"), 0, now)).toBe(false);
  });
  it("is true only past the limit", () => {
    expect(waitedTooLong(new Date("2026-11-02T11:00:00Z"), 7, now)).toBe(true);
    expect(waitedTooLong(new Date("2026-11-04T12:00:00Z"), 7, now)).toBe(false);
  });
});
