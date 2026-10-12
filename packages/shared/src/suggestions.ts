import { z } from "zod";

// Suggestions: the settings, the decision a team member makes, and the allowed status changes.
// One definition for the dashboard (form, Server Action) and the bot. Pure and free of Node APIs.
// Import it from "@aboutselphy/shared/suggestions" in client components.

export const MAX_SUGGESTION = 1500;
export const MAX_DECISION_REASON = 300;
export const SUGGESTION_STATUSES = ["open", "approved", "denied", "implemented"] as const;
export type SuggestionStatusName = (typeof SUGGESTION_STATUSES)[number];
export const DECISIONS = ["approved", "denied", "implemented"] as const;
export type Decision = (typeof DECISIONS)[number];

/** open can become any decision; an approved suggestion can later be marked implemented. Nothing else changes. */
export function canTransition(from: SuggestionStatusName, to: Decision): boolean {
  if (from === "open") return true;
  return from === "approved" && to === "implemented";
}

const snowflake = z.string().regex(/^\d{17,20}$/);

export const suggestionSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** "" = none. */
    channelId: z.union([z.literal(""), snowflake]),
    cooldownSeconds: z.number().int().min(0).max(3600),
  })
  .superRefine((v, ctx) => {
    if (v.enabled && !v.channelId) ctx.addIssue({ code: "custom", path: ["channelId"], message: "needsChannel" });
  });
export type SuggestionSettings = z.infer<typeof suggestionSettingsSchema>;

export const decisionInput = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(DECISIONS),
  reason: z.string().trim().max(MAX_DECISION_REASON),
});
export type DecisionInput = z.infer<typeof decisionInput>;

export const MAX_NOTE = 500;
export const MAX_NOTES_PER_SUGGESTION = 50;
export const noteInput = z.object({ suggestionId: z.string().min(1).max(64), body: z.string().trim().min(1).max(MAX_NOTE) });
export const mergeInput = z.object({ id: z.string().min(1).max(64), targetNumber: z.number().int().min(1).max(1_000_000) });
