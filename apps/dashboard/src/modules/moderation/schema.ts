import { z } from "zod";
import { snowflake } from "@aboutselphy/shared";
import type { ModCaseType } from "@aboutselphy/db";

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

/** Moderation settings form. An empty channel means "don't post cases anywhere". */
export const settingsSchema = z.object({
  logChannelId: z.union([snowflake, z.literal("")]),
  dmOnAction: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export type SettingsError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "failed";
export type SaveSettingsResult =
  | { ok: true; logChannelId: string; dmOnAction: boolean; botNotified: boolean }
  | { ok: false; error: SettingsError };

export type PardonError = "forbidden" | "invalid" | "notFound" | "notActiveWarning" | "failed";
export type PardonResult = { ok: true; logUpdated: boolean } | { ok: false; error: PardonError };
