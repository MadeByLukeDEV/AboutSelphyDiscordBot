import { AuditLogEvent } from "discord.js";
import { describe, expect, it } from "vitest";
import { caseFromAuditEntry, type AuditEntryLike } from "./audit-log";

const BOT = "999999999999999999";
const NOW = new Date("2026-10-09T12:00:00Z");

const entry = (over: Partial<AuditEntryLike>): AuditEntryLike => ({
  action: AuditLogEvent.MemberBanAdd,
  executorId: "111111111111111111",
  targetId: "222222222222222222",
  executorName: "Mod",
  targetName: "Target",
  reason: "spam",
  changes: [],
  ...over,
});

describe("caseFromAuditEntry", () => {
  it("records bans, unbans and kicks done in Discord", () => {
    expect(caseFromAuditEntry(entry({}), BOT, NOW)).toMatchObject({ type: "ban", source: "audit_log", reason: "spam" });
    expect(caseFromAuditEntry(entry({ action: AuditLogEvent.MemberBanRemove }), BOT, NOW)?.type).toBe("unban");
    expect(caseFromAuditEntry(entry({ action: AuditLogEvent.MemberKick }), BOT, NOW)?.type).toBe("kick");
  });

  it("skips the bot's own actions (they already have a case)", () => {
    expect(caseFromAuditEntry(entry({ executorId: BOT }), BOT, NOW)).toBeNull();
  });

  it("skips entries without an actor or target", () => {
    expect(caseFromAuditEntry(entry({ executorId: null }), BOT, NOW)).toBeNull();
    expect(caseFromAuditEntry(entry({ targetId: null }), BOT, NOW)).toBeNull();
  });

  it("ignores actions that aren't moderation", () => {
    expect(caseFromAuditEntry(entry({ action: AuditLogEvent.ChannelCreate }), BOT, NOW)).toBeNull();
    expect(
      caseFromAuditEntry(entry({ action: AuditLogEvent.MemberUpdate, changes: [{ key: "nick", new: "x" }] }), BOT, NOW),
    ).toBeNull();
  });

  it("turns a timeout into a case with duration and expiry", () => {
    const result = caseFromAuditEntry(
      entry({
        action: AuditLogEvent.MemberUpdate,
        changes: [{ key: "communication_disabled_until", new: "2026-10-09T13:00:00.000Z" }],
      }),
      BOT,
      NOW,
    );
    expect(result).toMatchObject({ type: "timeout", durationSeconds: 3600 });
    expect(result?.expiresAt?.toISOString()).toBe("2026-10-09T13:00:00.000Z");
  });

  it("turns a cleared timeout into an untimeout, but not when none was set", () => {
    const cleared = entry({
      action: AuditLogEvent.MemberUpdate,
      changes: [{ key: "communication_disabled_until", old: "2026-10-09T13:00:00.000Z" }],
    });
    expect(caseFromAuditEntry(cleared, BOT, NOW)?.type).toBe("untimeout");
    const nothing = entry({ action: AuditLogEvent.MemberUpdate, changes: [{ key: "communication_disabled_until" }] });
    expect(caseFromAuditEntry(nothing, BOT, NOW)).toBeNull();
  });

  it("ignores a malformed timeout date", () => {
    const bad = entry({
      action: AuditLogEvent.MemberUpdate,
      changes: [{ key: "communication_disabled_until", new: "not a date" }],
    });
    expect(caseFromAuditEntry(bad, BOT, NOW)).toBeNull();
  });
});
