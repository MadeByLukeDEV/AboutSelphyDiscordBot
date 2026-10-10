import { z } from "zod";

// Auto-responders. One definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/auto-responders" in client components.

export const MAX_AUTO_RESPONDERS = 50;
export const MAX_TRIGGER = 100;
export const MAX_RESPONSE = 1500;
export const MAX_RESPONDER_CHANNELS = 25;
export const MATCH_TYPES = ["word", "contains", "exact"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const autoResponderInput = z.object({
  id: z.string().min(1).max(64).optional(),
  trigger: z.string().trim().min(1).max(MAX_TRIGGER),
  matchType: z.enum(MATCH_TYPES),
  response: z.string().trim().min(1).max(MAX_RESPONSE),
  cooldownSeconds: z.number().int().min(0).max(86_400),
  /** Empty = everywhere. */
  channelIds: z.array(z.string().regex(/^\d{17,20}$/)).max(MAX_RESPONDER_CHANNELS),
  enabled: z.boolean(),
});
export type AutoResponderInput = z.infer<typeof autoResponderInput>;
