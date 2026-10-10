import { z } from "zod";
import { isAllowedImageUrl, MAX_IMAGE_URL } from "./announcement";

// Settings for the welcome features: auto-roles, the welcome, direct and goodbye messages,
// and restoring roles. One definition for the dashboard (form and Server Action); the bot
// reads the stored values and re-checks everything it uses. Pure and free of Node APIs.
// Import it from "@aboutselphy/shared/welcome" in client components.

export const MAX_WELCOME_TEMPLATE = 1000;
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
    welcomeTemplate: z.string().trim().min(1).max(MAX_WELCOME_TEMPLATE),
    welcomeAsEmbed: z.boolean(),
    welcomeColor: z.number().int().min(0).max(0xffffff),
    welcomeImageUrl: z.string().max(MAX_IMAGE_URL),
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
    if (v.goodbyeEnabled && !v.goodbyeChannelId) issue("goodbyeChannelId", "needsChannel");
  });
export type WelcomeSettings = z.infer<typeof welcomeSettingsSchema>;
