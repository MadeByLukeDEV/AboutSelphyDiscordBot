import { z } from "zod";

// Reminder limits and settings. One definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/reminders" in client components.

export const MAX_REMINDER_MESSAGE = 500;
export const MIN_REMINDER_SECONDS = 60;
export const MAX_REMINDER_SECONDS = 365 * 86_400;
export const MIN_PER_USER = 1;
export const MAX_PER_USER = 50;

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  maxPerUser: z.number().int().min(MIN_PER_USER).max(MAX_PER_USER),
});
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;
