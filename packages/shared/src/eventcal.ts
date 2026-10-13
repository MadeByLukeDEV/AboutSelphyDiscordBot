import { z } from "zod";
import { isPublicHttpsUrl } from "./webhooks";

// The event calendar announcer: reads a public calendar (.ics) and posts the events that match a rule, one message per event, plus an
// overview message. One definition for the dashboard and the bot. Pure. Import it from "@aboutselphy/shared/eventcal" in client components.

/** The community-run Sea of Thieves event calendar (a public Google Calendar). */
export const DEFAULT_CALENDAR_URL = "https://calendar.google.com/calendar/ical/c_10fomfvgafp5atjgb2t8i190i4%40group.calendar.google.com/public/basic.ics";
export const MAX_EVENT_RULES = 20;
export const MAX_RULE_TERMS = 10;
export const MAX_TERM = 40;
export const MIN_OVERVIEW_DAYS = 7;
export const MAX_OVERVIEW_DAYS = 90;
export const MAX_DAYS_AHEAD = 60;

const snowflake = z.string().regex(/^\d{17,20}$/);
const term = z.string().trim().min(1).max(MAX_TERM);

export const eventSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** An https address of a public iCalendar feed. */
    icsUrl: z.string().trim().max(500).refine(isPublicHttpsUrl, "url"),
    /** "" = no overview message. */
    overviewChannelId: z.union([z.literal(""), snowflake]),
    /** The overview lists events that run now or start within this many days. */
    overviewDays: z.number().int().min(MIN_OVERVIEW_DAYS).max(MAX_OVERVIEW_DAYS),
  });
export type EventSettings = z.infer<typeof eventSettingsSchema>;

export const eventRuleSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(60),
    /** The event's name contains one of these (any case). */
    words: z.array(term).max(MAX_RULE_TERMS),
    /** The calendar's own tags (for example twitch_drop). */
    categories: z.array(term).max(MAX_RULE_TERMS),
    channelId: snowflake,
    /** "" = nobody is pinged. */
    pingRoleId: z.union([z.literal(""), snowflake]),
    /** Post an event this many days before it starts (0 = on the day). */
    daysAhead: z.number().int().min(0).max(MAX_DAYS_AHEAD),
    /** Use an AI-written summary (rewards, who can take part) when the bot has an AI provider configured. */
    useAi: z.boolean().default(true),
    enabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.words.length + v.categories.length === 0) ctx.addIssue({ code: "custom", path: ["words"], message: "needsMatch" });
  });
export type EventRuleInput = z.infer<typeof eventRuleSchema>;

export const eventCheckResponse = z.object({ status: z.string().max(40), events: z.number().int(), posted: z.number().int(), edited: z.number().int() });
export type EventCheckResponse = z.infer<typeof eventCheckResponse>;
export const eventOverviewStatus = z.enum(["posted", "updated", "needsSetup", "channel", "failed"]);
export type EventOverviewStatus = z.infer<typeof eventOverviewStatus>;
