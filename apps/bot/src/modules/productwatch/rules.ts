import { z } from "zod";
import { escapeText, truncate } from "../../lib/escape";

// Product watch rules. Pure, so they are testable: reading a Shopify product's public `.js` data, comparing two looks, writing the message.

export type Variant = { title: string; price: number; available: boolean };
export type Snapshot = { title: string; variants: Variant[]; image: string | null };

const productJs = z.object({
  title: z.string().min(1).max(300),
  featured_image: z.string().max(600).nullish(),
  variants: z
    .array(z.object({ title: z.string().max(200), price: z.number().int().nonnegative(), available: z.boolean() }))
    .min(1)
    .max(100),
});

/** The shop's `<product>.js` answer -> what we keep. Null when it isn't a product (a block page, other JSON). */
export function parseProductJs(body: string): Snapshot | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = productJs.safeParse(json);
  if (!parsed.success) return null;
  const image = parsed.data.featured_image ? (parsed.data.featured_image.startsWith("//") ? `https:${parsed.data.featured_image}` : parsed.data.featured_image) : null;
  return {
    title: parsed.data.title,
    variants: parsed.data.variants.map((v) => ({ title: v.title, price: v.price, available: v.available })),
    // Only the shop's own CDN is ever used as a picture.
    image: image && /^https:\/\/cdn\.shopify\.com\//.test(image) ? image : null,
  };
}

const snapshotSchema = z.object({
  title: z.string(),
  variants: z.array(z.object({ title: z.string(), price: z.number(), available: z.boolean() })),
  image: z.string().nullable(),
});

/** A stored snapshot read back (null when it is missing or has an unexpected shape). */
export function readSnapshot(value: unknown): Snapshot | null {
  const parsed = snapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Prices are in the shop's own currency, in cents: 9999900 -> "99,999.00". */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type Change =
  | { kind: "title"; from: string; to: string }
  | { kind: "price"; variant: string; from: number; to: number }
  | { kind: "stock"; variant: string; available: boolean }
  | { kind: "added"; variant: string }
  | { kind: "removed"; variant: string };

/** What differs between two looks. Variants are matched by title. */
export function diffSnapshots(before: Snapshot, after: Snapshot): Change[] {
  const changes: Change[] = [];
  if (before.title !== after.title) changes.push({ kind: "title", from: before.title, to: after.title });
  const old = new Map(before.variants.map((v) => [v.title, v]));
  const now = new Map(after.variants.map((v) => [v.title, v]));
  for (const [title, v] of now) {
    const o = old.get(title);
    if (!o) {
      changes.push({ kind: "added", variant: title });
      continue;
    }
    if (o.price !== v.price) changes.push({ kind: "price", variant: title, from: o.price, to: v.price });
    if (o.available !== v.available) changes.push({ kind: "stock", variant: title, available: v.available });
  }
  for (const title of old.keys()) if (!now.has(title)) changes.push({ kind: "removed", variant: title });
  return changes;
}

const MAX_LINES = 12;

function line(c: Change, single: boolean): string {
  // For a one-option product the option's name ("Columbina") adds nothing, so it isn't repeated.
  const who = (variant: string) => (single || variant === "" ? "" : `${escapeText(variant)}: `);
  switch (c.kind) {
    case "title":
      return `Name: ${escapeText(c.from)} → **${escapeText(c.to)}**`;
    case "price":
      return `${who(c.variant)}Price ${formatPrice(c.from)} → **${formatPrice(c.to)}**`;
    case "stock":
      return `${who(c.variant)}${c.available ? "**Available again**" : "**Sold out**"}`;
    case "added":
      return `New option: **${escapeText(c.variant)}**`;
    case "removed":
      return `Option removed: ${escapeText(c.variant)}`;
  }
}

/** The text of the change message (markdown, escaped, cut to fit an embed). */
export function changeText(changes: readonly Change[], single: boolean): string {
  const lines = changes.slice(0, MAX_LINES).map((c) => `• ${line(c, single)}`);
  if (changes.length > MAX_LINES) lines.push(`… and ${changes.length - MAX_LINES} more`);
  return truncate(lines.join("\n"), 3500);
}
