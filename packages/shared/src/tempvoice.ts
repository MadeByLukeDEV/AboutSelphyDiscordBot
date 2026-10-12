import { z } from "zod";

/**
 * How many "join to create" lobbies there can be. A guard against runaway
 * configuration (and against a lobby per channel by accident), the same on the
 * bot and in the dashboard.
 */
export const MAX_TEMP_VOICE_LOBBIES = 10;

/** Per-role rules for temporary rooms (bitrate and the highest member limit an owner may set). */
export const MAX_ROLE_RULES = 15;
export const MAX_AFK_MOVE_MINUTES = 240;
export const roleRuleSchema = z
  .object({
    /** A role ID, or "everyone" for the base rule that applies to all members. */
    roleId: z.union([z.literal("everyone"), z.string().regex(/^\d{17,20}$/)]),
    bitrateKbps: z.number().int().min(8).max(384).nullable(),
    maxUserLimit: z.number().int().min(1).max(99).nullable(),
  })
  .refine((v) => v.bitrateKbps !== null || v.maxUserLimit !== null, { path: ["bitrateKbps"], message: "needsOne" });
export const roleRulesSchema = z
  .array(roleRuleSchema)
  .max(MAX_ROLE_RULES)
  .refine((rules) => new Set(rules.map((r) => r.roleId)).size === rules.length, { message: "duplicateRole" });
export type RoleRule = z.infer<typeof roleRuleSchema>;
