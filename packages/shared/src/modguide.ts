import { z } from "zod";
import { isAllowedImageUrl } from "./announcement";

// The moderators' guide: one embedded message (or a few, if it is long) in a staff channel that lists
// the commands a moderator may use, in categories. One definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/modguide" in client components.

export const MAX_GUIDE_TITLE = 100;
export const MAX_GUIDE_DESCRIPTION = 1500;
export const MAX_GUIDE_NOTES = 1500;
export const GUIDE_DEFAULT_COLOR = "#00FFA8";

export const modGuideInput = z.object({
  /** Empty until the admin picks one; posting needs it. */
  channelId: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/)]),
  title: z.string().trim().min(1).max(MAX_GUIDE_TITLE),
  description: z.string().trim().max(MAX_GUIDE_DESCRIPTION),
  /** The cover picture shown big on the first embed: https only, or empty for none. */
  imageUrl: z.string().trim().refine(isAllowedImageUrl, "image"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Optional last section, e.g. house rules for using the tools. */
  notes: z.string().trim().max(MAX_GUIDE_NOTES),
});
export type ModGuideInput = z.infer<typeof modGuideInput>;

/** What the bot would list, for the dashboard's preview: the categories and one line per command. */
export const modGuidePreviewResponse = z.object({
  categories: z.array(z.object({ title: z.string(), lines: z.array(z.string()) })),
});
export type ModGuidePreview = z.infer<typeof modGuidePreviewResponse>;

/** POST /internal/modguide/post: `messages` is how many Discord messages the guide now spans. */
export const modGuidePostStatus = z.enum(["done", "noChannel", "channel", "failed"]);
export const modGuidePostResponse = z.object({ status: modGuidePostStatus, messages: z.number().int().min(0) });
export type ModGuidePostResponse = z.infer<typeof modGuidePostResponse>;
