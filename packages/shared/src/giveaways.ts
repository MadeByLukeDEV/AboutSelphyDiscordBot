import { z } from "zod";
import { isAllowedImageUrl, MAX_IMAGE_URL, MAX_SCHEDULE_AHEAD_MS, MIN_SCHEDULE_AHEAD_MS } from "./announcement";

// What a giveaway may contain. One definition for the dashboard (form and Server Action); the
// bot re-checks everything before it posts. Pure and free of Node APIs.
// Import it from "@aboutselphy/shared/giveaways" in client components.

export const MAX_PRIZE = 200;
export const MAX_GIVEAWAY_DESCRIPTION = 1000;
export const MAX_WINNERS = 20;
/** Extra chances a bonus role can give (a member with it has 1 + this many tickets in the draw). */
export const MAX_BONUS_ENTRIES = 10;
/** Entry requirements beyond a role. */
export const MAX_REQUIRED_DAYS = 3650;
export const MAX_REQUIRED_LEVEL = 500;
/** How many more rounds a giveaway may repeat. */
export const MAX_REPEATS = 52;
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
    /** Members with this role get extra chances. "" = no bonus. */
    bonusRoleId: z.union([z.literal(""), snowflake]).default(""),
    /** Extra chances for the bonus role (0 = none). */
    bonusEntries: z.number().int().min(0).max(MAX_BONUS_ENTRIES).default(0),
    /** Discord account at least this many days old (0 = no limit). */
    minAccountDays: z.number().int().min(0).max(MAX_REQUIRED_DAYS).default(0),
    /** Member of this server for at least this many days (0 = no limit). */
    minMemberDays: z.number().int().min(0).max(MAX_REQUIRED_DAYS).default(0),
    /** At least this level in the leveling system (0 = no limit). */
    minLevel: z.number().int().min(0).max(MAX_REQUIRED_LEVEL).default(0),
    /** More rounds after this one ends (each lasts as long as this one; 0 = once). */
    repeatsLeft: z.number().int().min(0).max(MAX_REPEATS).default(0),
    /** Optional picture, https only. "" = none. */
    imageUrl: z.string().trim().max(MAX_IMAGE_URL).refine(isAllowedImageUrl, "image").default(""),
    /** Post it right after saving (otherwise it stays a draft). */
    start: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.bonusEntries > 0 && v.bonusRoleId === "") ctx.addIssue({ code: "custom", path: ["bonusRoleId"], message: "needsRole" });
    const at = Date.parse(v.endsAt);
    if (Number.isNaN(at)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "time" });
    else if (at < Date.now() + MIN_SCHEDULE_AHEAD_MS) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "past" });
    else if (at > Date.now() + MAX_SCHEDULE_AHEAD_MS) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "tooFar" });
  });
export type GiveawayInput = z.infer<typeof giveawayInput>;

export const GIVEAWAY_ACTIONS = ["start", "end", "reroll", "cancel"] as const;
export type GiveawayAction = (typeof GIVEAWAY_ACTIONS)[number];
