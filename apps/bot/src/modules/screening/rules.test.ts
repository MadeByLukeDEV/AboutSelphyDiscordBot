import { describe, expect, it } from "vitest";
import { screeningSettingsSchema } from "@aboutselphy/shared/screening";
import { canDecide, parseScreeningControl, screeningControlId, statusAfter } from "./rules";

describe("control ids", () => {
  it("round-trips approve and reject", () => {
    expect(parseScreeningControl(screeningControlId("approve", "abcdefghij12"))).toEqual({ decision: "approve", id: "abcdefghij12" });
    expect(parseScreeningControl(screeningControlId("reject", "abcdefghij12"))).toEqual({ decision: "reject", id: "abcdefghij12" });
  });
  it("refuses look-alikes", () => {
    for (const bad of ["sc:ban:abcdefghij12", "sc:approve:short", "sc:approve:abcdefghij12:x", "tk:approve:abcdefghij12", "sc:approve:BAD ID"]) expect(parseScreeningControl(bad), bad).toBeNull();
  });
});

describe("decisions", () => {
  it("only a pending entry can be decided", () => {
    expect(canDecide("pending")).toBe(true);
    for (const s of ["approved", "rejected", "left", ""]) expect(canDecide(s), s).toBe(false);
  });
  it("maps a decision to a status", () => {
    expect(statusAfter("approve")).toBe("approved");
    expect(statusAfter("reject")).toBe("rejected");
  });
});

describe("settings", () => {
  const ok = { enabled: true, channelId: "123456789012345678", approvedRoleId: "223456789012345678", pendingRoleId: "" };
  it("needs a channel and the approved role to be switched on", () => {
    expect(screeningSettingsSchema.safeParse(ok).success).toBe(true);
    expect(screeningSettingsSchema.safeParse({ ...ok, channelId: "" }).success).toBe(false);
    expect(screeningSettingsSchema.safeParse({ ...ok, approvedRoleId: "" }).success).toBe(false);
    expect(screeningSettingsSchema.safeParse({ ...ok, enabled: false, channelId: "", approvedRoleId: "" }).success).toBe(true);
  });
  it("the pending role must be a different role", () => {
    expect(screeningSettingsSchema.safeParse({ ...ok, pendingRoleId: ok.approvedRoleId }).success).toBe(false);
    expect(screeningSettingsSchema.safeParse({ ...ok, pendingRoleId: "323456789012345678" }).success).toBe(true);
  });
});
