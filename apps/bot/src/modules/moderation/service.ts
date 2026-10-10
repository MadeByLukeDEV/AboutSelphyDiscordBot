import { PermissionFlagsBits, type EmbedBuilder, type Guild, type GuildMember, type User } from "discord.js";
import type { ModCase, ModCaseSource } from "@aboutselphy/db";
import { escapeText, truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { getModConfig } from "./config";
import { formatDuration } from "./duration";
import { escalationDue, ruleFrom, windowStart } from "./escalation";
import { buildCaseEmbed, typeLabel } from "./embed";
import { checkHierarchy, DENIAL_MESSAGES } from "./hierarchy";
import {
  countActiveWarnings,
  countCasesByType,
  createCase,
  findCaseByNumber,
  listCasesForTarget,
  setCaseLogMessage,
} from "./repository";

export type ActionType = "warn" | "timeout" | "untimeout" | "kick" | "ban" | "unban" | "note";

export type ActionRequest = {
  guild: Guild;
  moderator: GuildMember;
  type: ActionType;
  targetId: string;
  /** The Discord user, when known (a user option, or fetched for unban). */
  targetUser: User | null;
  reason: string | null;
  /** Timeout length, or how long a ban lasts (omit for a permanent ban). */
  durationSeconds?: number;
  /** Where the action came from; defaults to a command. */
  source?: ModCaseSource;
  /** Ban only: delete this many days of the user's messages (0-7). */
  deleteDays?: number;
};

export type ActionResult = { ok: true; caseNumber: number; message: string } | { ok: false; message: string };

const fail = (message: string): ActionResult => ({ ok: false, message });

const REQUIRED_PERMISSION = {
  warn: null,
  note: null,
  timeout: PermissionFlagsBits.ModerateMembers,
  untimeout: PermissionFlagsBits.ModerateMembers,
  kick: PermissionFlagsBits.KickMembers,
  ban: PermissionFlagsBits.BanMembers,
  unban: PermissionFlagsBits.BanMembers,
} as const;

const PERMISSION_NAME = {
  [PermissionFlagsBits.ModerateMembers.toString()]: "Timeout Members",
  [PermissionFlagsBits.KickMembers.toString()]: "Kick Members",
  [PermissionFlagsBits.BanMembers.toString()]: "Ban Members",
} as const;

/** Audit-log reasons are capped at 512 characters by Discord. */
function auditReason(moderator: GuildMember, reason: string | null) {
  return truncate(`${moderator.user.username}: ${reason ?? "no reason given"}`, 500);
}

async function tryDm(user: User, text: string): Promise<boolean> {
  if (user.bot) return false;
  try {
    await user.send({ content: text, allowedMentions: { parse: [] } });
    return true;
  } catch {
    return false; // DMs closed, or no shared server any more: expected
  }
}

function dmText(type: ActionType, guild: Guild, reason: string | null, durationSeconds?: number) {
  const where = `**${escapeText(guild.name)}**`;
  const why = reason ? `\nReason: ${truncate(escapeText(reason), 500)}` : "";
  switch (type) {
    case "warn":
      return `You received a warning in ${where}.${why}`;
    case "timeout":
      return `You were timed out in ${where} for ${formatDuration(durationSeconds ?? 0)}.${why}`;
    case "kick":
      return `You were kicked from ${where}.${why}`;
    case "ban":
      return `You were banned from ${where}${durationSeconds ? ` for ${formatDuration(durationSeconds)}` : ""}.${why}`;
    default:
      return null;
  }
}

/**
 * Runs one moderation action: checks who may act on whom, performs the Discord
 * action, records a numbered case, and posts the case to the log channel.
 * Order matters: the case is only created once Discord accepted the action, so
 * a refused action leaves no phantom case. Returns a user-facing message and
 * never throws (details go to the server log only).
 */
export async function performAction(req: ActionRequest): Promise<ActionResult> {
  const { guild, moderator, type, targetId } = req;
  const me = guild.members.me ?? (await guild.members.fetchMe());

  // -- bot permission -------------------------------------------------------
  const needed = REQUIRED_PERMISSION[type];
  if (needed && !me.permissions.has(needed)) {
    return fail(`I'm missing the "${PERMISSION_NAME[needed.toString()]}" permission.`);
  }

  // -- who is the target ----------------------------------------------------
  const lookupMember = type !== "unban" && type !== "note";
  const member = lookupMember ? await guild.members.fetch(targetId).catch(() => null) : null;
  if ((type === "timeout" || type === "untimeout" || type === "kick") && !member) {
    return fail("That user isn't in the server.");
  }

  if (lookupMember) {
    const verdict = checkHierarchy({
      actorId: moderator.id,
      targetId,
      botId: me.id,
      ownerId: guild.ownerId,
      actorPosition: moderator.roles.highest.position,
      targetPosition: member ? member.roles.highest.position : null,
      botPosition: me.roles.highest.position,
    });
    if (!verdict.ok) return fail(DENIAL_MESSAGES[verdict.reason]);
  }

  if (member) {
    const capable =
      type === "timeout" || type === "untimeout"
        ? member.moderatable
        : type === "kick"
          ? member.kickable
          : type === "ban"
            ? member.bannable
            : true;
    if (!capable) return fail("I can't do that to this member. Check my role position and permissions.");
  }

  if (type === "untimeout" && !(member!.communicationDisabledUntilTimestamp && member!.communicationDisabledUntilTimestamp > Date.now())) {
    return fail("That member isn't timed out.");
  }
  if (type === "unban") {
    const ban = await guild.bans.fetch({ user: targetId, force: true }).catch(() => null);
    if (!ban) return fail("That user isn't banned.");
  }

  const config = await getModConfig();
  const user = req.targetUser ?? member?.user ?? null;
  const reason = req.reason;
  const dm = config.dmOnAction && user ? dmText(type, guild, reason, req.durationSeconds) : null;
  const expiresAt = (type === "timeout" || type === "ban") && req.durationSeconds ? new Date(Date.now() + req.durationSeconds * 1000) : null;

  // -- the Discord action ---------------------------------------------------
  try {
    // A kicked or banned member can no longer be DMed, so tell them first.
    if (dm && user && (type === "kick" || type === "ban")) await tryDm(user, dm);

    switch (type) {
      case "timeout":
        await member!.timeout(req.durationSeconds! * 1000, auditReason(moderator, reason));
        break;
      case "untimeout":
        await member!.timeout(null, auditReason(moderator, reason));
        break;
      case "kick":
        await member!.kick(auditReason(moderator, reason));
        break;
      case "ban":
        await guild.members.ban(targetId, {
          reason: auditReason(moderator, reason),
          deleteMessageSeconds: Math.min(7, Math.max(0, req.deleteDays ?? 0)) * 86_400,
        });
        break;
      case "unban":
        await guild.members.unban(targetId, auditReason(moderator, reason));
        break;
      case "warn":
      case "note":
        break; // nothing to do in Discord, the case is the action
    }

    if (dm && user && (type === "warn" || type === "timeout")) await tryDm(user, dm);
  } catch (err) {
    log.error({ err, type, target: targetId }, "moderation action failed");
    return fail("Discord refused that action. Check my permissions and role position.");
  }

  // -- the case -------------------------------------------------------------
  let row: ModCase;
  try {
    row = await createCase({
      type,
      source: req.source ?? "command",
      targetId,
      targetName: user?.username ?? null,
      moderatorId: moderator.id,
      moderatorName: moderator.user.username,
      reason,
      durationSeconds: req.durationSeconds ?? null,
      expiresAt,
    });
  } catch (err) {
    log.error({ err, type, target: targetId }, "moderation action done but case could not be saved");
    return fail("The action was done, but I couldn't record the case. Tell an admin.");
  }

  log.info({ case: row.caseNumber, type, target: targetId, moderator: moderator.id }, "moderation action");
  await postCaseLog(guild, row);

  // A warning may be the one that tips the member over the escalation threshold.
  const escalated = type === "warn" ? await escalateIfDue(guild, targetId, user) : null;
  return {
    ok: true,
    caseNumber: row.caseNumber,
    message: `Case #${row.caseNumber} · ${typeLabel(type)} · <@${targetId}>${escalated ? `\n${escalated}` : ""}`,
  };
}

/** After a warning: applies the configured escalation if this is the N-th active warning. Never throws. */
async function escalateIfDue(guild: Guild, targetId: string, user: User | null): Promise<string | null> {
  try {
    const rule = ruleFrom(await getModConfig());
    if (!rule) return null;
    const warnings = await countActiveWarnings(targetId, windowStart(rule, new Date()));
    if (!escalationDue(warnings, rule)) return null;

    const me = guild.members.me ?? (await guild.members.fetchMe());
    log.info({ target: targetId, warnings, action: rule.action }, "warning escalation");
    const result = await performAction({
      guild,
      moderator: me,
      type: rule.action,
      targetId,
      targetUser: user,
      reason: rule.windowDays ? `Reached ${warnings} active warnings in ${rule.windowDays} days` : `Reached ${warnings} active warnings`,
      ...(rule.durationSeconds ? { durationSeconds: rule.durationSeconds } : {}),
      source: "automod",
    });
    if (!result.ok) log.warn({ target: targetId, message: result.message }, "warning escalation could not be applied");
    return result.ok ? `Escalation: ${warnings} active warnings, so case #${result.caseNumber} (${rule.action}) was applied.` : `Escalation due (${warnings} warnings) but not applied: ${result.message}`;
  } catch (err) {
    log.error({ err, target: targetId }, "warning escalation failed");
    return null;
  }
}

/** Posts the case embed to the log channel. Best effort: never breaks the action. */
export async function postCaseLog(guild: Guild, row: ModCase): Promise<void> {
  try {
    const { logChannelId } = await getModConfig();
    if (!logChannelId) {
      log.info({ case: row.caseNumber }, "no mod log channel set, case not posted");
      return;
    }
    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel?.isTextBased() || !("send" in channel)) {
      log.warn({ channel: logChannelId }, "mod log channel missing or not text-based");
      return;
    }
    const message = await channel.send({ embeds: [buildCaseEmbed(row)], allowedMentions: { parse: [] } });
    await setCaseLogMessage(row.id, channel.id, message.id);
  } catch (err) {
    log.error({ err, case: row.caseNumber }, "could not post case to the mod log");
  }
}

/** Posts a log entry that isn't a case (a purge, a lock, slow mode) to the mod log channel. Best effort. */
export async function postModNote(guild: Guild, embed: EmbedBuilder): Promise<void> {
  try {
    const { logChannelId } = await getModConfig();
    if (!logChannelId) return;
    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel?.isTextBased() || !("send" in channel)) return;
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    log.error({ err }, "could not post a moderation note to the mod log");
  }
}

/**
 * Re-renders the log embed of an existing case (e.g. after the dashboard
 * pardoned a warning). Never throws: a deleted log message or channel is
 * reported as a status, not an error.
 */
export async function refreshCaseLog(
  guild: Guild,
  caseNumber: number,
): Promise<"updated" | "no-log-message" | "not-found" | "failed"> {
  try {
    const row = await findCaseByNumber(caseNumber);
    if (!row) return "not-found";
    if (!row.logChannelId || !row.logMessageId) return "no-log-message";

    const channel = await guild.channels.fetch(row.logChannelId).catch(() => null);
    if (!channel?.isTextBased()) return "no-log-message";
    const message = await channel.messages.fetch(row.logMessageId).catch(() => null);
    if (!message) return "no-log-message"; // deleted by hand

    await message.edit({ embeds: [buildCaseEmbed(row)], allowedMentions: { parse: [] } });
    log.info({ case: caseNumber }, "case log message refreshed");
    return "updated";
  } catch (err) {
    log.error({ err, case: caseNumber }, "could not refresh the case log message");
    return "failed";
  }
}

export const getCase = findCaseByNumber;

export async function getInfractions(targetId: string) {
  const [recent, counts] = await Promise.all([listCasesForTarget(targetId, 10), countCasesByType(targetId)]);
  return { recent, counts };
}
