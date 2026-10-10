import { z } from "zod";
import { isAllowedImageUrl, MAX_IMAGE_URL } from "./announcement";

// Settings for the welcome features: auto-roles, the welcome, direct and goodbye messages,
// and restoring roles. One definition for the dashboard (form and Server Action); the bot
// reads the stored values and re-checks everything it uses. Pure and free of Node APIs.
// Import it from "@aboutselphy/shared/welcome" in client components.

export const MAX_WELCOME_TEMPLATE = 1000;
/** How many welcome texts can be saved; the bot picks one at random for each member. */
export const MAX_WELCOME_TEMPLATES = 10;
export const CARD_MODES = ["background", "sticker"] as const;
export type CardMode = (typeof CARD_MODES)[number];
export const MAX_CARD_TITLE = 40;
export const MAX_CARD_SUBTITLE = 80;
export const DEFAULT_CARD_TITLE = "Welcome";
export const DEFAULT_CARD_SUBTITLE = "Member #{count}";
export const MAX_AUTO_ROLES = 5;
export const DEFAULT_WELCOME_COLOR = 0x00ffa8;
export const WELCOME_PLACEHOLDERS = ["user", "username", "server", "count"] as const;
export type WelcomePlaceholder = (typeof WELCOME_PLACEHOLDERS)[number];

export const DEFAULT_WELCOME_TEMPLATE = "Welcome to {server}, {user}! You are member #{count}.";
export const DEFAULT_DM_TEMPLATE = "Welcome to {server}! Have a look at the rules and say hi.";
export const DEFAULT_GOODBYE_TEMPLATE = "{username} has left the server.";

/** Replaces {user} {username} {server} {count}. Unknown placeholders stay as typed. The caller decides how the values look (the bot escapes them). */
export function fillWelcome(template: string, values: Record<WelcomePlaceholder, string>): string {
  return template.replace(/\{(user|username|server|count)\}/g, (_, key: WelcomePlaceholder) => values[key]);
}

const snowflake = z.string().regex(/^\d{17,20}$/);
const roleList = z
  .array(snowflake)
  .max(MAX_AUTO_ROLES)
  .refine((ids) => new Set(ids).size === ids.length, "duplicate");

export const welcomeSettingsSchema = z
  .object({
    autoRoleIds: roleList,
    botAutoRoleIds: roleList,
    restoreRoles: z.boolean(),
    welcomeEnabled: z.boolean(),
    /** "" = none. */
    welcomeChannelId: z.union([z.literal(""), snowflake]),
    /** Up to 10 variants; one is picked at random per member. */
    welcomeTemplates: z.array(z.string().trim().min(1).max(MAX_WELCOME_TEMPLATE)).max(MAX_WELCOME_TEMPLATES),
    welcomeAsEmbed: z.boolean(),
    welcomeColor: z.number().int().min(0).max(0xffffff),
    welcomeImageUrl: z.string().max(MAX_IMAGE_URL),
    /** A picture made for each member (name, avatar, number) on the admin's own image. */
    welcomeCardEnabled: z.boolean(),
    welcomeCardMode: z.enum(CARD_MODES),
    welcomeCardTitle: z.string().trim().min(1).max(MAX_CARD_TITLE),
    welcomeCardSubtitle: z.string().trim().max(MAX_CARD_SUBTITLE),
    dmEnabled: z.boolean(),
    dmTemplate: z.string().trim().min(1).max(MAX_WELCOME_TEMPLATE),
    goodbyeEnabled: z.boolean(),
    goodbyeChannelId: z.union([z.literal(""), snowflake]),
    goodbyeTemplate: z.string().trim().min(1).max(MAX_WELCOME_TEMPLATE),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!isAllowedImageUrl(v.welcomeImageUrl.trim())) issue("welcomeImageUrl", "image");
    if (v.welcomeEnabled && !v.welcomeChannelId) issue("welcomeChannelId", "needsChannel");
    if (v.welcomeEnabled && v.welcomeTemplates.length === 0) issue("welcomeTemplates", "needsText");
    if (v.goodbyeEnabled && !v.goodbyeChannelId) issue("goodbyeChannelId", "needsChannel");
  });
export type WelcomeSettings = z.infer<typeof welcomeSettingsSchema>;

/** The text on the welcome card: {username} {server} {count}. */
export function fillCardText(template: string, values: { username: string; server: string; count: string }): string {
  return fillWelcome(template, { user: values.username, username: values.username, server: values.server, count: values.count });
}
