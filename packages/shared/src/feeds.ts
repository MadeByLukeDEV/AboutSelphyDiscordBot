import { z } from "zod";

// Feed announcer (RSS/Atom). One definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/feeds" in client components.

export const MAX_FEEDS = 20;
export const MIN_INTERVAL_MINUTES = 5;
export const MAX_INTERVAL_MINUTES = 1440;
export const DEFAULT_INTERVAL_MINUTES = 10;
export const MAX_FEED_TEMPLATE = 300;
export const DEFAULT_FEED_TEMPLATE = "{name}: {title} {link}";
export const MAX_FEED_URL = 500;

/**
 * A syntax check: http or https, a host, no credentials, no whitespace. Whether the bot may connect is
 * decided when it connects (public https hosts, plus the internal hosts listed in RSS_INTERNAL_HOSTS,
 * such as a feed bridge on the same network).
 */
export function isFeedUrlSyntax(value: string): boolean {
  if (value.length > MAX_FEED_URL || /[\u0000-\u001f\u007f\s]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname !== "" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

const snowflake = z.string().regex(/^\d{17,20}$/);

export const feedInput = z
  .object({
    id: z.string().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(60),
    /** Empty when editing = keep the stored address. */
    url: z.string().trim().max(MAX_FEED_URL),
    channelId: snowflake,
    /** "" = nobody is pinged. */
    pingRoleId: z.union([z.literal(""), snowflake]),
    messageTemplate: z.string().trim().min(1).max(MAX_FEED_TEMPLATE),
    intervalMinutes: z.number().int().min(MIN_INTERVAL_MINUTES).max(MAX_INTERVAL_MINUTES),
    enabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.url === "" ? !v.id : !isFeedUrlSyntax(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "url" });
  });
export type FeedInput = z.infer<typeof feedInput>;
