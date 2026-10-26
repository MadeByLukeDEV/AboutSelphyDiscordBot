import { z } from "zod";

// Product watch: a Shopify product page the bot checks for changes (price, availability, name, options).
// One definition for the dashboard and the bot. Pure. Import it from "@aboutselphy/shared/productwatch".

export const MAX_PRODUCT_WATCHES = 20;
/** How often every watched product is looked at. */
export const PRODUCT_WATCH_INTERVAL_MINUTES = 30;

const snowflake = z.string().regex(/^\d{17,20}$/);

/**
 * A product page address as typed (https, optionally with a language prefix such as /en-at, tracking parameters allowed) ->
 * the clean page address and the shop's public JSON address of the same product (`<page>.js`). Anything else is null.
 */
export function parseProductUrl(input: string): { pageUrl: string; jsUrl: string; handle: string } | null {
  if (input.length > 600 || /[\u0000-\u001f\u007f\s]/.test(input.trim())) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
  const match = /^((?:\/[a-z]{2}(?:-[a-z]{2})?)?)\/products\/([a-z0-9][a-z0-9-]{0,200})\/?$/i.exec(url.pathname);
  if (!match) return null;
  const pageUrl = `https://${url.host}${match[1]}/products/${match[2]}`.toLowerCase();
  return { pageUrl, jsUrl: `${pageUrl}.js`, handle: match[2]!.toLowerCase() };
}

export const productWatchInput = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().min(1).max(600).refine((v) => parseProductUrl(v) !== null, "badUrl"),
  channelId: snowflake,
  /** "" = no ping. */
  pingRoleId: z.union([z.literal(""), snowflake]),
  enabled: z.boolean(),
});
export type ProductWatchInput = z.infer<typeof productWatchInput>;
