import { z } from "zod";

// Sticky messages: one definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/sticky" in client components.

export const MAX_STICKY = 10;
export const MAX_STICKY_CONTENT = 1500;
export const STICKY_COLOR = 0x00ffa8;

export const stickyInput = z.object({
  id: z.string().min(1).max(64).optional(),
  channelId: z.string().regex(/^\d{17,20}$/),
  /** Staff-written text; markdown is kept, nothing in it can ping. */
  content: z.string().trim().min(1).max(MAX_STICKY_CONTENT),
  enabled: z.boolean(),
});
export type StickyInput = z.infer<typeof stickyInput>;

export const autoPublishInput = z.object({ channelId: z.string().regex(/^\d{17,20}$/) });
