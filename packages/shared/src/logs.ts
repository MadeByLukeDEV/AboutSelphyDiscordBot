import { z } from "zod";

// The kinds of server log, each with its own channel and switch. One definition for the
// dashboard (form and Server Action) and the bot. Pure and free of Node APIs.
// Import it from "@aboutselphy/shared/logs" in client components.

export const LOG_CATEGORIES = ["members", "memberUpdates", "voice", "server"] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

const snowflake = z.string().regex(/^\d{17,20}$/);
const route = z.object({
  enabled: z.boolean(),
  /** "" = none. */
  channelId: z.union([z.literal(""), snowflake]),
});

export const logSettingsSchema = z
  .object({ members: route, memberUpdates: route, voice: route, server: route })
  .superRefine((v, ctx) => {
    for (const c of LOG_CATEGORIES) {
      if (v[c].enabled && !v[c].channelId) ctx.addIssue({ code: "custom", path: [c, "channelId"], message: "needsChannel" });
    }
  });
export type LogSettings = z.infer<typeof logSettingsSchema>;

export const DEFAULT_LOG_SETTINGS: LogSettings = {
  members: { enabled: false, channelId: "" },
  memberUpdates: { enabled: false, channelId: "" },
  voice: { enabled: false, channelId: "" },
  server: { enabled: false, channelId: "" },
};
