import { z } from "zod";

// Webhooks, both directions. One definition for the dashboard (forms, Server Actions, the public
// endpoint) and the bot. Pure. Import it from "@aboutselphy/shared/webhooks" in client components.
// The signing code is Node only and lives in "@aboutselphy/shared/webhook-signature".

export const OUTBOUND_EVENTS = ["mod.case", "twitch.live"] as const;
export type OutboundEvent = (typeof OUTBOUND_EVENTS)[number];
/** "test" is only ever sent by the "Send a test" button. */
export type AnyWebhookEvent = OutboundEvent | "test";

export const ENDPOINT_PROVIDERS = ["generic", "github", "kofi"] as const;
export type EndpointProvider = (typeof ENDPOINT_PROVIDERS)[number];

export const MAX_ENDPOINTS = 20;
export const MAX_OUTBOUND = 10;
/** Requests to the public endpoint bigger than this are refused before anything is read. */
export const MAX_INBOUND_BODY = 8 * 1024;
/** GitHub's push payloads are bigger; only GitHub endpoints may send this much. */
export const MAX_GITHUB_BODY = 128 * 1024;
export const SIGNATURE_TOLERANCE_SECONDS = 300;
export const MAX_URL = 500;

const snowflake = z.string().regex(/^\d{17,20}$/);

/** A Discord webhook address, exactly the shape Discord hands out. */
export function isDiscordWebhookUrl(value: string): boolean {
  return /^https:\/\/(?:ptb\.|canary\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d{15,25}\/[A-Za-z0-9_-]{20,120}$/.test(value);
}

/**
 * A syntax check for a generic https address: https only, no credentials, a real host name (not an IP
 * address, "localhost" or an internal name) and port 443 or 8443. The bot checks again, where it
 * matters, when it connects (the address a name resolves to is checked then).
 */
export function isPublicHttpsUrl(value: string): boolean {
  if (value.length > MAX_URL || /[\u0000-\u001f\u007f\s]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
    if (url.port !== "" && url.port !== "443" && url.port !== "8443") return false;
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") || host.startsWith("[") || /^[0-9.]+$/.test(host)) return false;
    return !(host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home.arpa"));
  } catch {
    return false;
  }
}

/** What an external service sends to an endpoint. At least a title or some text. */
export const inboundPayload = z
  .object({
    title: z.string().trim().max(256).optional(),
    content: z.string().trim().max(2000).optional(),
    /** Makes the title a link. */
    url: z.string().trim().max(MAX_URL).refine((u) => u === "" || (u.startsWith("https://") && !/\s/.test(u)), "url").optional(),
    color: z.number().int().min(0).max(0xffffff).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.title) || Boolean(v.content), "empty");
export type InboundPayload = z.infer<typeof inboundPayload>;

export const endpointInput = z
  .object({
    id: z.string().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(60),
    channelId: snowflake,
    enabled: z.boolean(),
    /** Fixed when the endpoint is made; ignored when editing. */
    provider: z.enum(ENDPOINT_PROVIDERS).default("generic"),
    /** Ko-fi only, when making the endpoint: the verification token Ko-fi shows (Ko-fi decides it, we can't). */
    secret: z.string().trim().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.provider === "kofi" && !v.id && (!v.secret || v.secret.length < 8 || /\s/.test(v.secret))) ctx.addIssue({ code: "custom", path: ["secret"], message: "token" });
  });
export type EndpointInput = z.infer<typeof endpointInput>;

export const outboundInput = z
  .object({
    id: z.string().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(60),
    kind: z.enum(["discord", "generic"]),
    /** Empty when editing = keep the stored address. */
    url: z.string().trim().max(MAX_URL),
    events: z.array(z.enum(OUTBOUND_EVENTS)).min(1).max(OUTBOUND_EVENTS.length),
    enabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.url === "") {
      if (!v.id) ctx.addIssue({ code: "custom", path: ["url"], message: "url" });
      return;
    }
    const ok = v.kind === "discord" ? isDiscordWebhookUrl(v.url) : isPublicHttpsUrl(v.url);
    if (!ok) ctx.addIssue({ code: "custom", path: ["url"], message: "url" });
  });
export type OutboundInput = z.infer<typeof outboundInput>;

/** The text a Discord webhook gets for an event, from plain (unescaped) facts. */
export type EventFacts = { title: string; lines: string[]; color: number };
