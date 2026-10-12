import { describe, expect, it } from "vitest";
import { auditTarget, splitAction, wasSuccessful } from "./rules";

describe("wasSuccessful", () => {
  it("only an explicit ok:true counts", () => {
    expect(wasSuccessful({ ok: true })).toBe(true);
    expect(wasSuccessful({ ok: true, extra: 1 })).toBe(true);
    expect(wasSuccessful({ ok: false, error: "x" })).toBe(false);
    expect(wasSuccessful({ ok: "yes" })).toBe(false);
    expect(wasSuccessful(null)).toBe(false);
    expect(wasSuccessful(undefined)).toBe(false);
    expect(wasSuccessful("ok")).toBe(false);
  });
});

describe("auditTarget", () => {
  it("keeps a short id or number", () => {
    expect(auditTarget("clx9abc123")).toBe("clx9abc123");
    expect(auditTarget(42)).toBe("42");
  });
  it("never stores objects, forms, long or odd text (they can hold secrets or members' words)", () => {
    expect(auditTarget({ url: "https://secret" })).toBe("");
    expect(auditTarget("x".repeat(65))).toBe("");
    expect(auditTarget("has spaces and = signs")).toBe("");
    expect(auditTarget(undefined)).toBe("");
    expect(auditTarget(Number.NaN)).toBe("");
  });
});

describe("splitAction", () => {
  it("splits the verb from the rest", () => {
    expect(splitAction("saveStreamer")).toEqual({ verb: "save", rest: "Streamer" });
    expect(splitAction("removeAutoPublish")).toEqual({ verb: "remove", rest: "Auto Publish" });
    expect(splitAction("post")).toEqual({ verb: "post", rest: "" });
  });
});
