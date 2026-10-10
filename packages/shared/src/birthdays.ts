import { z } from "zod";

// Birthday rules and settings. One definition for the dashboard (form, Server Action) and the bot.
// Pure (Intl only). Import it from "@aboutselphy/shared/birthdays" in client components.

export const MAX_BIRTHDAY_MESSAGE = 300;
export const DEFAULT_BIRTHDAY_MESSAGE = "🎂 Happy birthday {user}!";
export const DEFAULT_TIME_ZONE = "Europe/Berlin";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // February allows the 29th

/** A real calendar date without a year (29 February is allowed). */
export function isValidDay(month: number, day: number): boolean {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1]!;
}

export function isValidTimeZone(zone: string): boolean {
  if (!zone || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const snowflake = z.string().regex(/^\d{17,20}$/);
const optionalSnowflake = z.union([z.literal(""), snowflake]);

export const birthdaySettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** "" = none. */
    channelId: optionalSnowflake,
    roleId: optionalSnowflake,
    message: z.string().trim().min(1).max(MAX_BIRTHDAY_MESSAGE),
    timeZone: z.string().max(64).refine(isValidTimeZone, "timeZone"),
  })
  .superRefine((v, ctx) => {
    if (v.enabled && !v.channelId && !v.roleId) ctx.addIssue({ code: "custom", path: ["channelId"], message: "needsTarget" });
  });
export type BirthdaySettings = z.infer<typeof birthdaySettingsSchema>;
