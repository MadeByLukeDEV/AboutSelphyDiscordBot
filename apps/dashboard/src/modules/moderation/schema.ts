import { z } from "zod";
import { snowflake } from "@aboutselphy/shared";
import type { ModCaseType } from "@aboutselphy/db";
import { MAX_TIMEOUT_SECONDS, MIN_TIMEOUT_SECONDS, parseDuration } from "@aboutselphy/shared/duration";

/** Same values as the Prisma enum; `satisfies` makes a mismatch a type error. */
export const CASE_TYPES = [
  "warn",
  "timeout",
  "untimeout",
  "kick",
  "ban",
  "unban",
  "note",
  "antibot",
] as const satisfies readonly ModCaseType[];

export const PAGE_SIZE = 25;

/**
 * The cases page's URL query. Anything invalid falls back to "no filter" /
 * page 1 instead of erroring: it's user-editable input in the address bar.
 */
export const caseQuerySchema = z.object({
  type: z.enum(CASE_TYPES).optional().catch(undefined),
  q: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || undefined)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
export type CaseQuery = z.infer<typeof caseQuerySchema>;

export const caseNumberSchema = z.coerce.number().int().positive().max(2_147_483_647);

export const ESCALATION_ACTIONS = ["timeout", "kick", "ban"] as const;
export type EscalationAction = (typeof ESCALATION_ACTIONS)[number];
export const MIN_ESCALATION_WARNINGS = 2;
export const MAX_ESCALATION_WARNINGS = 20;

/**
 * Moderation settings form. An empty channel means "don't post cases anywhere".
 * Escalation: when on, every N-th active warning applies the action; a timeout
 * needs a length, a kick has none, a ban may have one (temporary) or not.
 * `escalationDuration` is text like "1h" or "3d", parsed the way the bot parses it.
 */
export const settingsSchema = z
  .object({
    logChannelId: z.union([snowflake, z.literal("")]),
    dmOnAction: z.boolean(),
    escalationEnabled: z.boolean(),
    escalationThreshold: z.number().int().min(MIN_ESCALATION_WARNINGS).max(MAX_ESCALATION_WARNINGS),
    escalationAction: z.enum(ESCALATION_ACTIONS),
    escalationDuration: z.string().trim().max(20),
  })
  .superRefine((v, ctx) => {
    if (!v.escalationEnabled) return;
    const seconds = v.escalationDuration ? parseDuration(v.escalationDuration) : null;
    const bad = (message: string) => ctx.addIssue({ code: "custom", path: ["escalationDuration"], message });
    if (v.escalationDuration && seconds === null) return bad("unreadable");
    if (v.escalationAction === "timeout" && (seconds === null || seconds < MIN_TIMEOUT_SECONDS || seconds > MAX_TIMEOUT_SECONDS)) {
      return bad("timeoutRange");
    }
    if (v.escalationAction === "kick" && seconds !== null) return bad("kickNoDuration");
    if (v.escalationAction === "ban" && seconds !== null && seconds < MIN_TIMEOUT_SECONDS) return bad("tooShort");
  });
export type SettingsInput = z.infer<typeof settingsSchema>;

export const DEFAULT_ESCALATION = {
  escalationEnabled: false,
  escalationThreshold: 3,
  escalationAction: "timeout",
  escalationDuration: "1h",
} as const satisfies Partial<SettingsInput>;

export type SettingsError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "failed";
export type SaveSettingsResult =
  | { ok: true; settings: SettingsInput; botNotified: boolean }
  | { ok: false; error: SettingsError };

export type PardonError = "forbidden" | "invalid" | "notFound" | "notActiveWarning" | "failed";
export type PardonResult = { ok: true; logUpdated: boolean } | { ok: false; error: PardonError };
