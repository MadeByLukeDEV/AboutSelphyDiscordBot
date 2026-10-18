import { z } from "zod";

// The member overview posted in Discord: the same content as the public /features page, as a few embedded messages in a channel.
// One definition for the dashboard (which builds the text in the chosen language from its catalogs) and the bot (which posts it).
// Import it from "@aboutselphy/shared/memberoverview" in client components.

export const OVERVIEW_LANGUAGES = ["en", "de"] as const;
export type OverviewLanguage = (typeof OVERVIEW_LANGUAGES)[number];

export const memberOverviewInput = z.object({
  /** Empty until the admin picks one; posting needs it. */
  channelId: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/)]),
  language: z.enum(OVERVIEW_LANGUAGES),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type MemberOverviewInput = z.infer<typeof memberOverviewInput>;

const text = (max: number) => z.string().trim().min(1).max(max);

/** What the bot posts: plain text only (the bot adds no markup of its own to it beyond bold/code around titles and commands). */
export const memberOverviewPayload = z.object({
  title: text(100),
  intro: text(400),
  /** Where the full page lives (the title links to it); https only. */
  url: z.string().url().max(300).startsWith("https://").or(z.literal("")),
  footer: z.string().trim().max(200),
  groups: z
    .array(
      z.object({
        title: text(80),
        intro: z.string().trim().max(200),
        items: z.array(z.object({ title: text(80), body: text(700), commands: z.array(z.string().trim().min(1).max(40)).max(12) })).min(1).max(12),
      }),
    )
    .min(1)
    .max(12),
});
export type MemberOverviewPayload = z.infer<typeof memberOverviewPayload>;

export const memberOverviewPostStatus = z.enum(["done", "noChannel", "channel", "failed"]);
export const memberOverviewPostResponse = z.object({ status: memberOverviewPostStatus, messages: z.number().int().min(0) });
export type MemberOverviewPostResponse = z.infer<typeof memberOverviewPostResponse>;
