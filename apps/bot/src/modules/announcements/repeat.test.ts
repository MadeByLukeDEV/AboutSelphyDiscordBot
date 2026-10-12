import { describe, expect, it } from "vitest";
import { announcementInput, announcementTemplateInput, nextRun } from "@aboutselphy/shared/announcement";

const at = (s: string) => new Date(s);

describe("nextRun", () => {
  it("daily and weekly step from the previous time", () => {
    expect(nextRun(at("2026-11-02T10:00:00Z"), "daily", at("2026-11-02T10:00:30Z"))).toEqual(at("2026-11-03T10:00:00Z"));
    expect(nextRun(at("2026-11-02T10:00:00Z"), "weekly", at("2026-11-02T10:00:30Z"))).toEqual(at("2026-11-09T10:00:00Z"));
  });
  it("skips missed rounds after downtime instead of replaying them", () => {
    expect(nextRun(at("2026-11-02T10:00:00Z"), "daily", at("2026-11-06T12:00:00Z"))).toEqual(at("2026-11-07T10:00:00Z"));
    expect(nextRun(at("2026-11-02T10:00:00Z"), "weekly", at("2026-11-30T12:00:00Z"))).toEqual(at("2026-12-07T10:00:00Z"));
  });
  it("monthly keeps the day, cut to the month's end", () => {
    expect(nextRun(at("2026-01-31T09:00:00Z"), "monthly", at("2026-01-31T09:01:00Z"))).toEqual(at("2026-02-28T09:00:00Z"));
    expect(nextRun(at("2026-11-15T09:00:00Z"), "monthly", at("2026-11-15T09:01:00Z"))).toEqual(at("2026-12-15T09:00:00Z"));
    expect(nextRun(at("2026-12-15T09:00:00Z"), "monthly", at("2026-12-15T09:01:00Z"))).toEqual(at("2027-01-15T09:00:00Z"));
  });
});

describe("announcement input with repeats", () => {
  const base = { content: "hi", embedEnabled: false, embedTitle: "", embedDescription: "", embedColor: 0, embedImageUrl: "", channelId: "123456789012345678", pingRoleId: "", pingEveryone: false };
  const soon = new Date(Date.now() + 2 * 3_600_000).toISOString();
  const later = new Date(Date.now() + 5 * 86_400_000).toISOString();
  it("accepts a schedule with a repeat and an end", () => {
    expect(announcementInput.safeParse({ ...base, mode: "schedule", scheduledFor: soon, repeat: "weekly", repeatUntil: later }).success).toBe(true);
  });
  it("refuses a repeat without a schedule, and an end before the start", () => {
    expect(announcementInput.safeParse({ ...base, mode: "now", repeat: "daily" }).success).toBe(false);
    expect(announcementInput.safeParse({ ...base, mode: "draft", repeat: "daily" }).success).toBe(false);
    expect(announcementInput.safeParse({ ...base, mode: "schedule", scheduledFor: later, repeat: "daily", repeatUntil: soon }).success).toBe(false);
  });
  it("defaults to no repeat", () => {
    const r = announcementInput.safeParse({ ...base, mode: "draft" });
    expect(r.success && r.data.repeat).toBe("none");
  });
});

describe("announcementTemplateInput", () => {
  const t = { name: " Weekly news ", content: "hello", embedEnabled: false, embedTitle: "", embedDescription: "", embedColor: 0, embedImageUrl: "", channelId: "", pingRoleId: "" };
  it("accepts a template without channel or role and trims the name", () => {
    const r = announcementTemplateInput.safeParse(t);
    expect(r.success && r.data.name).toBe("Weekly news");
  });
  it("needs a name, some content and a safe picture address", () => {
    expect(announcementTemplateInput.safeParse({ ...t, name: "  " }).success).toBe(false);
    expect(announcementTemplateInput.safeParse({ ...t, content: " " }).success).toBe(false);
    expect(announcementTemplateInput.safeParse({ ...t, embedEnabled: true, embedImageUrl: "http://x.test/a.png" }).success).toBe(false);
  });
});
