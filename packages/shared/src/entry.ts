import { z } from "zod";

// How new members are let in: the verification gate (a button, optionally a question) and raid protection
// (an alarm and an optional automatic reaction when many accounts join at once). One definition for the dashboard
// and the bot. Pure. Import it from "@aboutselphy/shared/entry" in client components.

const snowflake = z.string().regex(/^\d{17,20}$/);
const optionalId = z.union([z.literal(""), snowflake]);

export const MAX_ACCOUNT_AGE_DAYS = 365;
export const MAX_KICK_AFTER_HOURS = 720;

export const verificationSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** Where the panel with the button is posted. */
    channelId: optionalId,
    /** The role a member gets by verifying. */
    verifiedRoleId: optionalId,
    /** Optional: given on join and taken away on verifying (for servers where everybody can see everything). */
    unverifiedRoleId: optionalId,
    panelTitle: z.string().trim().min(1).max(256),
    panelDescription: z.string().trim().max(2000),
    buttonLabel: z.string().trim().min(1).max(80),
    /** Optional question the member must answer (typed into a small form). "" = just the button. */
    question: z.string().trim().max(200),
    answer: z.string().trim().max(100),
    /** Accounts younger than this many days can't verify yet (0 = no limit). */
    minAccountAgeDays: z.number().int().min(0).max(MAX_ACCOUNT_AGE_DAYS),
    /** Kick members who joined after this was switched on and still haven't verified after this many hours (0 = never). */
    kickAfterHours: z.number().int().min(0).max(MAX_KICK_AFTER_HOURS),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.enabled && v.channelId === "") issue("channelId", "needsChannel");
    if (v.enabled && v.verifiedRoleId === "") issue("verifiedRoleId", "needsRole");
    if (v.question !== "" && v.answer === "") issue("answer", "needsAnswer");
    if (v.unverifiedRoleId !== "" && v.unverifiedRoleId === v.verifiedRoleId) issue("unverifiedRoleId", "sameRole");
  });
export type VerificationSettings = z.infer<typeof verificationSettingsSchema>;

export const verificationPanelStatus = z.enum(["posted", "updated", "channel", "needsSetup", "failed"]);
export type VerificationPanelStatus = z.infer<typeof verificationPanelStatus>;

export const RAID_ACTIONS = ["alert", "timeout", "kick"] as const;
export type RaidAction = (typeof RAID_ACTIONS)[number];

export const raidSettingsSchema = z.object({
  enabled: z.boolean(),
  /** This many joins within `windowSeconds` count as a raid. */
  joinThreshold: z.number().int().min(3).max(100),
  windowSeconds: z.number().int().min(5).max(300),
  /** What happens to accounts that join while a raid is on: only the alert, a timeout, or a kick. */
  action: z.enum(RAID_ACTIONS),
  /** Timeout length for the "timeout" action. */
  actionMinutes: z.number().int().min(1).max(1440),
  /** How long raid mode lasts before it ends by itself. */
  raidMinutes: z.number().int().min(1).max(180),
});
export type RaidSettings = z.infer<typeof raidSettingsSchema>;
