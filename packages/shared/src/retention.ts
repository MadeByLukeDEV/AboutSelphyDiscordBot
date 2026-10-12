import { z } from "zod";

// Data retention: how long the bot keeps personal data before a daily job removes it. 0 = keep (nothing is
// removed). One definition for the dashboard and the bot. Pure. Import it from "@aboutselphy/shared/retention".

export const MAX_RETENTION_DAYS = 3650;

const days = z.number().int().min(0).max(MAX_RETENTION_DAYS);

export const retentionSettingsSchema = z.object({
  /** Closed tickets: the saved transcript (every message) is removed after this many days; the ticket itself stays. */
  ticketTranscriptDays: days,
  /** Moderation cases older than this are deleted, except permanent bans and anything still running. */
  caseDays: days,
  /** Decided suggestions (approved, denied, implemented) and their votes. */
  suggestionDays: days,
  /** Members who earned no XP for this long lose their level record. */
  inactiveXpDays: days,
});
export type RetentionSettings = z.infer<typeof retentionSettingsSchema>;

export const RETENTION_FIELDS = ["ticketTranscriptDays", "caseDays", "suggestionDays", "inactiveXpDays"] as const;
