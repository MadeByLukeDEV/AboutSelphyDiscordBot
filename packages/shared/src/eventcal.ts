import { z } from "zod";
import { isAllowedImageUrl } from "./announcement";
import { classifyMedia } from "./eventcal-article";
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
/** Extra article-only sources (one per game) besides the main calendar. */
export const MAX_EVENT_SOURCES = 8;

const snowflake = z.string().regex(/^\d{17,20}$/);
const term = z.string().trim().min(1).max(MAX_TERM);

/** Fills the date tokens of a page address template with sample values, to check the rest is a public https address. */
const sampleUrl = (v: string): string => v.replaceAll("{month}", "october").replaceAll("{mm}", "10").replaceAll("{year}", "2026");

export const FETCH_MODES = ["auto", "plain", "crawl4ai"] as const;
export const MAX_LEAD_TIMES = 4;
export const DEFAULT_ACCENT = "#00ffa8";

/** The key under which an item is stored: NFKC, lower case, one space, at most 80 characters. "Gilded Phoenix Wheel" always finds the same row. */
export const itemKey = (name: string): string => name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);

/** Days before the start: whole numbers 0-60, no duplicates, largest first, at most four. */
const leadDaysField = (min: number) =>
  z
    .array(z.number().int().min(0).max(MAX_DAYS_AHEAD))
    .min(min)
    .max(MAX_LEAD_TIMES)
    .transform((a) => [...new Set(a)].sort((x, y) => y - x));

/** Per kind: how many days before the start an event is announced (first = announcement, others = reminders). A kind left out uses the rule's own times. */
export const reminderDefaultsSchema = z.object({ drop: leadDaysField(1), event: leadDaysField(1), update: leadDaysField(1), sale: leadDaysField(1), other: leadDaysField(1) }).partial();
export type ReminderDefaults = z.infer<typeof reminderDefaultsSchema>;

/** A game (or any source of events): its calendar feed and/or its article page, and where its overview and monthly summary go. */
export const eventSourceSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
  /** An https address of a public iCalendar feed. "" = none. */
  icsUrl: z.union([z.literal(""), z.string().trim().max(500).refine(isPublicHttpsUrl, "url")]).default(""),
  /** An article page with {month} {mm} {year} in it (for example .../this-month-{month}{year}), read for this and next month. "" = none. */
  pageUrlTemplate: z.union([z.literal(""), z.string().trim().max(300).refine((v) => isPublicHttpsUrl(sampleUrl(v)), "url")]).default(""),
  /** A CSS selector that narrows the page to the article. "" = automatic. */
  contentSelector: z.string().trim().max(200).default(""),
  fetchMode: z.enum(FETCH_MODES).default("auto"),
  /** "" = no overview message. */
  overviewChannelId: z.union([z.literal(""), snowflake]),
  /** The overview lists events that run now or start within this many days. */
  overviewDays: z.number().int().min(MIN_OVERVIEW_DAYS).max(MAX_OVERVIEW_DAYS),
  /** "" = no monthly summary. */
  summaryChannelId: z.union([z.literal(""), snowflake]),
  /** Post the monthly summary by itself when a new month has events. */
  summaryAuto: z.boolean().default(false),
  /** The colour of this game's drawn pictures. */
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(DEFAULT_ACCENT),
  /** Put a drawn picture on the monthly summary. */
  summaryImage: z.boolean().default(false),
  publicWidget: z.boolean().default(false),
  /** Announcement times per kind of event. */
  reminderDefaults: reminderDefaultsSchema.default({}),
});
export type EventSourceInput = z.infer<typeof eventSourceSchema>;

export const EVENT_KINDS = ["drop", "event", "update", "sale", "other"] as const;

const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

/** An event added or edited by hand. Editing locks it: a sync never overwrites it again. */
export const gameEventSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  sourceId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  kind: z.enum(EVENT_KINDS),
  allDay: z.boolean(),
  start: dateTime,
  end: z.union([z.literal(""), dateTime]),
  description: z.string().trim().max(4000),
  summary: z.string().trim().max(600),
  items: z.array(z.string().trim().min(1).max(80)).max(30),
  imageUrl: z.union([z.literal(""), z.string().trim().max(500).refine(isAllowedImageUrl, "image")]),
  videoUrl: z.union([z.literal(""), z.string().trim().max(500).refine((v) => classifyMedia(v) === "video", "video")]),
  /** Overrides the rules' lead times for this event (days before the start). Empty = use the rules'. */
  reminderDays: leadDaysField(0).default([]),
});
export type GameEventInput = z.infer<typeof gameEventSchema>;

export const eventRuleSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(60),
    /** The event's name contains one of these (any case). */
    words: z.array(term).max(MAX_RULE_TERMS),
    /** The calendar's own tags (for example twitch_drop). */
    categories: z.array(term).max(MAX_RULE_TERMS),
    /** Also matches every event of these kinds. */
    kinds: z.array(z.enum(EVENT_KINDS)).max(EVENT_KINDS.length).default([]),
    channelId: snowflake,
    /** "" = nobody is pinged. */
    pingRoleId: z.union([z.literal(""), snowflake]),
    /** Post an event this many days before it starts (0 = on the day). The first (largest) is the announcement, the others are reminders: for example 7 and 2. */
    /** Optional: the times come from the event or from the game's defaults per kind. Kept as the last fallback. */
    leadDays: leadDaysField(1).optional(),
    /** Attach a drawn picture (drop card with the item pictures, or an event card) to the posts. */
    useCard: z.boolean().default(false),
    /** Also announce every occurrence of a repeating series ("Every Tuesday"), for example a weekly reminder. */
    postSeries: z.boolean().default(false),
    /** Use an AI-written summary (rewards, who can take part) when the bot has an AI provider configured. */
    useAi: z.boolean().default(true),
    /** The source (game) whose events this rule looks at. */
    sourceId: z.string().min(1).max(64),
    enabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.words.length + v.categories.length + v.kinds.length === 0) ctx.addIssue({ code: "custom", path: ["words"], message: "needsMatch" });
  });
export type EventRuleInput = z.infer<typeof eventRuleSchema>;

export const eventCheckResponse = z.object({ status: z.string().max(40), events: z.number().int(), posted: z.number().int(), edited: z.number().int() });
export type EventCheckResponse = z.infer<typeof eventCheckResponse>;
export const eventOverviewStatus = z.enum(["posted", "updated", "needsSetup", "channel", "failed"]);
export type EventOverviewStatus = z.infer<typeof eventOverviewStatus>;

/** POST /internal/eventcal/repost: post an event again (the old message is deleted). */
export const eventRepostBody = z.object({ id: z.string().min(1).max(64) });
export const eventRepostStatus = z.enum(["done", "not-found", "gone", "channel", "failed"]);
export type EventRepostStatus = z.infer<typeof eventRepostStatus>;

/** POST /internal/eventcal/monthly: post (or update) the detailed summary of this month or the next. */
export const eventMonthlyBody = z.object({ month: z.enum(["current", "next"]), sourceId: z.string().max(64).default("") });

/** POST /internal/eventcal/check: read the sources now (all, or just one) and post what is due. */
export const eventCheckBody = z.object({ sourceId: z.string().max(64).default("") });

/** POST /internal/eventcal/overview: which source's overview message to post. "" = the main calendar. */
export const eventOverviewBody = z.object({ sourceId: z.string().max(64).default("") });

/** POST /internal/eventcal/preview: draw a sample picture from the saved settings (an event's card, or a month's overview picture). */
export const eventPreviewBody = z.object({ sourceId: z.string().min(1).max(64), eventId: z.string().max(64).default(""), month: z.enum(["none", "current", "next"]).default("none") });
export const eventPreviewResponse = z.object({ png: z.string().min(1) });

