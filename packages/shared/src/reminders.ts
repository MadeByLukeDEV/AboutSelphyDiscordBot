import { z } from "zod";
import { memberCardFields } from "./member-card";

// Reminder limits and settings. One definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/reminders" in client components.

export const MAX_REMINDER_MESSAGE = 500;
export const MIN_REMINDER_SECONDS = 60;
export const MAX_REMINDER_SECONDS = 365 * 86_400;
export const MIN_PER_USER = 1;
export const MAX_PER_USER = 50;

/** Where a member wants a reminder: a DM, or a message in the channel it was set in. */
export const REMINDER_DELIVERIES = ["dm", "channel"] as const;
export type ReminderDelivery = (typeof REMINDER_DELIVERIES)[number];

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  maxPerUser: z.number().int().min(MIN_PER_USER).max(MAX_PER_USER),
  /** The only channel /remind works in; empty = anywhere. */
  channelId: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/)]),
  ...memberCardFields,
});
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;
