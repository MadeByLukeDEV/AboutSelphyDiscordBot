import { z } from "zod";
import { MAX_SCHEDULE_AHEAD_MS, MIN_SCHEDULE_AHEAD_MS } from "./announcement";

// What a giveaway may contain. One definition for the dashboard (form and Server Action); the
// bot re-checks everything before it posts. Pure and free of Node APIs.
// Import it from "@aboutselphy/shared/giveaways" in client components.

export const MAX_PRIZE = 200;
export const MAX_GIVEAWAY_DESCRIPTION = 1000;
export const MAX_WINNERS = 20;
export const GIVEAWAY_COLOR = 0x00ffa8;

const snowflake = z.string().regex(/^\d{17,20}$/);

export const giveawayInput = z
  .object({
    id: z.string().min(1).max(64).optional(),
    channelId: snowflake,
    prize: z.string().trim().min(1).max(MAX_PRIZE),
    description: z.string().trim().max(MAX_GIVEAWAY_DESCRIPTION),
    winnerCount: z.number().int().min(1).max(MAX_WINNERS),
    /** ISO time the giveaway ends. */
    endsAt: z.string().max(40),
    /** "" = everyone can enter. */
    requiredRoleId: z.union([z.literal(""), snowflake]),
    /** "" = nobody is pinged. */
    pingRoleId: z.union([z.literal(""), snowflake]),
    /** Post it right after saving (otherwise it stays a draft). */
    start: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const at = Date.parse(v.endsAt);
    if (Number.isNaN(at)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "time" });
    else if (at < Date.now() + MIN_SCHEDULE_AHEAD_MS) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "past" });
    else if (at > Date.now() + MAX_SCHEDULE_AHEAD_MS) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "tooFar" });
  });
export type GiveawayInput = z.infer<typeof giveawayInput>;

export const GIVEAWAY_ACTIONS = ["start", "end", "reroll", "cancel"] as const;
export type GiveawayAction = (typeof GIVEAWAY_ACTIONS)[number];
