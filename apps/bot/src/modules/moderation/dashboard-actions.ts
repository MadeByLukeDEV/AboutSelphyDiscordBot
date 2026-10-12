import type { Guild } from "discord.js";
import type { ModerationActBody } from "@aboutselphy/shared/moderation-act";
import { log } from "../../lib/log";
import { staffLevel } from "../../lib/permissions";
import { performAction, type ActionResult } from "./service";

// Moderation actions started from the dashboard. Discord sees the bot acting (its own role hierarchy and permissions
// still decide what is possible), the case names the staff member who pressed the button, and the source says
// "dashboard". Staff members and the server owner are never a target from here: that is a matter for the server
// owner in Discord, not for one click on a web page.

/** Why a target may not be acted on from the dashboard, or null if it may. Pure. */
export function protectedTarget(input: { targetId: string; botId: string; ownerId: string; staff: "admin" | "moderator" | null }): string | null {
  if (input.targetId === input.botId) return "I can't do that to myself.";
  if (input.targetId === input.ownerId) return "The server owner can't be acted on from the dashboard.";
  if (input.staff) return "Staff members can't be acted on from the dashboard.";
  return null;
}

export async function actFromDashboard(guild: Guild, body: ModerationActBody): Promise<ActionResult> {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const member = await guild.members.fetch(body.targetId).catch(() => null);
  const refusal = protectedTarget({ targetId: body.targetId, botId: me.id, ownerId: guild.ownerId, staff: staffLevel(member) });
  if (refusal) return { ok: false, message: refusal };

  log.info({ type: body.type, target: body.targetId, staff: body.staffName }, "moderation: action from the dashboard");
  return performAction({
    guild,
    moderator: me,
    type: body.type,
    targetId: body.targetId,
    targetUser: member?.user ?? null,
    reason: body.reason || null,
    ...(body.durationSeconds ? { durationSeconds: body.durationSeconds } : {}),
    ...(body.deleteDays ? { deleteDays: body.deleteDays } : {}),
    source: "dashboard",
    actor: { id: "dashboard", name: body.staffName },
  });
}
