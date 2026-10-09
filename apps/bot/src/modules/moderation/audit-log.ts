import { AuditLogEvent, Events, type Client, type GuildAuditLogsEntry } from "discord.js";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { truncate } from "../../lib/escape";
import { postCaseLog } from "./service";
import { createCase, type NewCase } from "./repository";

/** The few fields of an audit-log entry we read, so the mapping is testable with plain objects. */
export type AuditEntryLike = {
  action: number;
  executorId: string | null;
  targetId: string | null;
  executorName: string | null;
  targetName: string | null;
  reason: string | null;
  changes: ReadonlyArray<{ key: string; old?: unknown; new?: unknown }>;
};

/**
 * Turns an audit-log entry into a case, or null when it isn't one we record
 * (other actions, or entries without a clear actor/target).
 *
 * `botId` entries are skipped: the bot's own actions already created a case
 * through its commands, so recording them again would double every case.
 */
export function caseFromAuditEntry(entry: AuditEntryLike, botId: string, now = new Date()): NewCase | null {
  if (!entry.executorId || !entry.targetId) return null;
  if (entry.executorId === botId) return null;

  const base = {
    source: "audit_log" as const,
    targetId: entry.targetId,
    targetName: entry.targetName,
    moderatorId: entry.executorId,
    moderatorName: entry.executorName,
    reason: entry.reason ? truncate(entry.reason, 1000) : null,
  };

  switch (entry.action) {
    case AuditLogEvent.MemberKick:
      return { ...base, type: "kick" };
    case AuditLogEvent.MemberBanAdd:
      return { ...base, type: "ban" };
    case AuditLogEvent.MemberBanRemove:
      return { ...base, type: "unban" };
    case AuditLogEvent.MemberUpdate: {
      // A timeout is a member update that changes communication_disabled_until.
      const change = entry.changes.find((c) => c.key === "communication_disabled_until");
      if (!change) return null; // nickname/role changes etc.
      const until = typeof change.new === "string" ? new Date(change.new) : null;
      if (until && !Number.isNaN(until.getTime()) && until > now) {
        return {
          ...base,
          type: "timeout",
          expiresAt: until,
          durationSeconds: Math.max(1, Math.round((until.getTime() - now.getTime()) / 1000)),
        };
      }
      // Cleared (or already in the past) while it used to be set.
      return change.old ? { ...base, type: "untimeout" } : null;
    }
    default:
      return null;
  }
}

function toLike(entry: GuildAuditLogsEntry): AuditEntryLike {
  const target = entry.target as { username?: string } | null;
  return {
    action: entry.action,
    executorId: entry.executorId,
    targetId: entry.targetId,
    executorName: entry.executor?.username ?? null,
    targetName: target && typeof target.username === "string" ? target.username : null,
    reason: entry.reason,
    changes: entry.changes.map((c) => ({ key: c.key, old: c.old, new: c.new })),
  };
}

/** Needs the GuildModeration intent and the View Audit Log permission. */
export function registerAuditLog(client: Client) {
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    if (guild.id !== env().DISCORD_GUILD_ID) return;
    try {
      const input = caseFromAuditEntry(toLike(entry), client.user!.id);
      if (!input) return;
      const row = await createCase(input);
      log.info(
        { case: row.caseNumber, type: row.type, target: row.targetId, moderator: row.moderatorId },
        "moderation action captured from the audit log",
      );
      await postCaseLog(guild, row);
    } catch (err) {
      log.error({ err, action: entry.action }, "could not record an audit-log entry");
    }
  });
}
