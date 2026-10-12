import { z } from "zod";

// The screening queue: new members wait for a staff member to approve or reject them. One definition for the dashboard and
// the bot. Pure. Import it from "@aboutselphy/shared/screening" in client components.

const snowflake = z.string().regex(/^\d{17,20}$/);
const optionalId = z.union([z.literal(""), snowflake]);

export const screeningSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** The staff channel where each new member's card (with Approve and Reject buttons) is posted. */
    channelId: optionalId,
    /** Given when a member is approved. */
    approvedRoleId: optionalId,
    /** Optional: given on join and taken away on approval, to keep the member out of channels meanwhile. */
    pendingRoleId: optionalId,
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.enabled && v.channelId === "") issue("channelId", "needsChannel");
    if (v.enabled && v.approvedRoleId === "") issue("approvedRoleId", "needsRole");
    if (v.pendingRoleId !== "" && v.pendingRoleId === v.approvedRoleId) issue("pendingRoleId", "sameRole");
  });
export type ScreeningSettings = z.infer<typeof screeningSettingsSchema>;

export const SCREENING_DECISIONS = ["approve", "reject"] as const;
export type ScreeningDecision = (typeof SCREENING_DECISIONS)[number];

/** POST /internal/screening/decide: a staff member decided on the dashboard; the bot does the rest. */
export const screeningDecideBody = z.object({ id: z.string().min(1).max(40), decision: z.enum(SCREENING_DECISIONS), staffName: z.string().trim().min(1).max(100) });
export const screeningDecideStatus = z.enum(["done", "notFound", "alreadyDecided", "failed"]);
export type ScreeningDecideStatus = z.infer<typeof screeningDecideStatus>;
