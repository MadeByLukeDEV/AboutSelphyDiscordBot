import { z } from "zod";
import { isPanelEmoji } from "./role-panel";

// Tickets: the settings and the shape of a saved transcript. One definition for the dashboard
// (form, Server Action, page) and the bot. Pure and free of Node APIs. Import it from
// "@aboutselphy/shared/tickets" in client components.

export const MAX_STAFF_ROLES = 5;
/** One row of five buttons on the panel. */
export const MAX_TICKET_CATEGORIES = 5;
export const MAX_OPEN_PER_USER = 5;
export const MAX_TICKET_TEXT = 1000;
/** What an opener may say the ticket is about. */
export const MAX_TICKET_REASON = 300;
/** 30 days. */
export const MAX_AUTOCLOSE_HOURS = 720;
export const MAX_CLAIMS_PER_STAFF = 50;
export const DEFAULT_TICKET_COLOR = 0x00ffa8;
export const DEFAULT_PANEL_TITLE = "Need help?";
export const DEFAULT_PANEL_DESCRIPTION = "Press the button to open a private ticket with the team.";
export const DEFAULT_BUTTON_LABEL = "Open a ticket";
export const DEFAULT_TICKET_WELCOME = "Hi {user}, thanks for opening ticket #{number}. Tell us what you need and the team will be with you soon.";

/** Replaces {user} (the caller passes a mention) and {number}. Unknown placeholders stay as typed. */
export function fillTicketTemplate(template: string, values: { user: string; number: string }): string {
  return template.replace(/\{(user|number)\}/g, (_, key: "user" | "number") => values[key]);
}

/** A channel name like "ticket-0042". */
export function ticketChannelName(number: number): string {
  return `ticket-${String(number).padStart(4, "0")}`;
}

const snowflake = z.string().regex(/^\d{17,20}$/);

export const ticketSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** "" = none. */
    panelChannelId: z.union([z.literal(""), snowflake]),
    categoryId: z.union([z.literal(""), snowflake]),
    logChannelId: z.union([z.literal(""), snowflake]),
    staffRoleIds: z
      .array(snowflake)
      .max(MAX_STAFF_ROLES)
      .refine((ids) => new Set(ids).size === ids.length, "duplicate"),
    maxOpenPerUser: z.number().int().min(1).max(MAX_OPEN_PER_USER),
    /** Ask what the ticket is about before opening it. */
    askReason: z.boolean(),
    /** DM the opener a star rating after closing. */
    askRating: z.boolean(),
    /** Hours without a message before a ticket is closed automatically; 0 = never. */
    autoCloseHours: z.number().int().min(0).max(MAX_AUTOCLOSE_HOURS),
    /** Open tickets one staff member can have claimed at once; 0 = no limit. */
    maxClaimsPerStaff: z.number().int().min(0).max(MAX_CLAIMS_PER_STAFF),
    panelTitle: z.string().trim().min(1).max(256),
    panelDescription: z.string().trim().max(2000),
    panelColor: z.number().int().min(0).max(0xffffff),
    buttonLabel: z.string().trim().min(1).max(80),
    welcomeTemplate: z.string().trim().min(1).max(MAX_TICKET_TEXT),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.enabled && !v.panelChannelId) issue("panelChannelId", "needsPanelChannel");
    if (v.enabled && !v.categoryId) issue("categoryId", "needsCategory");
    if (v.enabled && v.staffRoleIds.length === 0) issue("staffRoleIds", "needsStaff");
  });
export type TicketSettings = z.infer<typeof ticketSettingsSchema>;

// -- the transcript ---------------------------------------------------------------------------

export const MAX_TRANSCRIPT_MESSAGES = 2000;
export const MAX_TRANSCRIPT_CONTENT = 4000;

export const transcriptMessage = z.object({
  id: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorBot: z.boolean(),
  /** ISO time. */
  at: z.string(),
  content: z.string(),
  attachments: z.array(z.object({ name: z.string(), url: z.string() })),
  /** How many embeds the message had (their content is not kept). */
  embeds: z.number().int().min(0),
});
export type TranscriptMessage = z.infer<typeof transcriptMessage>;

export const transcriptSchema = z.object({
  version: z.literal(1),
  messages: z.array(transcriptMessage).max(MAX_TRANSCRIPT_MESSAGES),
  /** True when the ticket had more messages than were kept. */
  truncated: z.boolean(),
});
export type Transcript = z.infer<typeof transcriptSchema>;

/** Only Discord's own CDN is ever linked from a transcript. */
export function isDiscordAttachmentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "cdn.discordapp.com" || url.hostname === "media.discordapp.net");
  } catch {
    return false;
  }
}

// -- categories ----------------------------------------------------------------------------------

export const ticketCategoryInput = z.object({
  /** Present for an existing category (its panel button and open tickets keep pointing at it). */
  id: z.string().min(1).max(40).optional(),
  label: z.string().trim().min(1).max(80),
  emoji: z.string().max(64).refine(isPanelEmoji, "emoji"),
  /** "" = the general ticket category. */
  discordCategoryId: z.union([z.literal(""), snowflake]),
  /** Empty = the general staff roles. */
  staffRoleIds: z.array(snowflake).max(MAX_STAFF_ROLES),
});
export type TicketCategoryInput = z.infer<typeof ticketCategoryInput>;

export const ticketCategoriesSchema = z
  .array(ticketCategoryInput)
  .max(MAX_TICKET_CATEGORIES)
  .refine((list) => new Set(list.map((c) => c.label.toLowerCase())).size === list.length, "duplicate");
