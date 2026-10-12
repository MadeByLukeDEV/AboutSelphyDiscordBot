import { z } from "zod";
import { MAX_TIMEOUT_SECONDS, MIN_TIMEOUT_SECONDS } from "./duration";

// Moderation actions started from the dashboard: one definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/moderation-act" in client components.

export const DASHBOARD_ACTIONS = ["warn", "timeout", "untimeout", "kick", "ban", "unban", "note"] as const;
export type DashboardAction = (typeof DASHBOARD_ACTIONS)[number];

export const MAX_ACT_REASON = 500;
/** A temporary ban may last up to a year; a permanent one has no length. */
export const MAX_TEMP_BAN_SECONDS = 365 * 86_400;

/** Actions that must say why (same as the slash commands). */
export const REASON_REQUIRED: ReadonlySet<DashboardAction> = new Set(["warn", "kick", "ban", "note"]);

const snowflake = z.string().regex(/^\d{17,20}$/);

/** The bot's request body. The dashboard has already turned "3d" into seconds. */
export const moderationActBody = z
  .object({
    type: z.enum(DASHBOARD_ACTIONS),
    targetId: snowflake,
    reason: z.string().trim().max(MAX_ACT_REASON),
    durationSeconds: z.number().int().positive().optional(),
    deleteDays: z.number().int().min(0).max(7).optional(),
    /** The staff member's name, recorded as the moderator of the case. */
    staffName: z.string().trim().min(1).max(100),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (REASON_REQUIRED.has(v.type) && v.reason === "") issue("reason", "reason");
    if (v.type === "timeout" && (v.durationSeconds === undefined || v.durationSeconds < MIN_TIMEOUT_SECONDS || v.durationSeconds > MAX_TIMEOUT_SECONDS)) issue("durationSeconds", "duration");
    if (v.type === "ban" && v.durationSeconds !== undefined && v.durationSeconds > MAX_TEMP_BAN_SECONDS) issue("durationSeconds", "duration");
    if (v.type !== "timeout" && v.type !== "ban" && v.durationSeconds !== undefined) issue("durationSeconds", "duration");
    if (v.type !== "ban" && v.deleteDays !== undefined && v.deleteDays !== 0) issue("deleteDays", "deleteDays");
  });
export type ModerationActBody = z.infer<typeof moderationActBody>;

export const moderationActResponse = z.object({ ok: z.boolean(), message: z.string().max(500), caseNumber: z.number().int().positive().optional() });
export type ModerationActResponse = z.infer<typeof moderationActResponse>;
