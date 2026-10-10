import { z } from "zod";

// Leveling: the XP curve and the settings. One definition for the dashboard (form and Server
// Action) and the bot. Pure and free of Node APIs. Import it from "@aboutselphy/shared/levels"
// in client components.

export const MAX_LEVEL = 500;
export const MAX_REWARDS = 25;
export const MAX_NO_XP = 50;
export const MAX_ANNOUNCE_TEMPLATE = 300;
export const DEFAULT_ANNOUNCE_TEMPLATE = "GG {user}, you reached level {level}!";
export const ANNOUNCE_MODES = ["off", "same", "channel"] as const;
export type AnnounceMode = (typeof ANNOUNCE_MODES)[number];

/** XP needed to go from `level` to `level + 1` (the MEE6 curve: 5n² + 50n + 100). */
export const xpToNext = (level: number): number => 5 * level * level + 50 * level + 100;

/** Total XP a member needs to have reached `level` (level 0 = 0 XP). */
export function totalXpForLevel(level: number): number {
  const n = Math.max(0, Math.floor(level));
  return (5 * (n - 1) * n * (2 * n - 1)) / 6 + (50 * n * (n - 1)) / 2 + 100 * n;
}

/** The level that `xp` reaches (capped at MAX_LEVEL). */
export function levelFromXp(xp: number): number {
  let level = 0;
  let rest = Math.max(0, Math.floor(xp));
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return level;
}

export type LevelProgress = { level: number; into: number; needed: number; percent: number; total: number };

/** Where `xp` sits: the level, the XP gathered towards the next one, and how much that takes. */
export function progressOf(xp: number): LevelProgress {
  const total = Math.max(0, Math.floor(xp));
  const level = levelFromXp(total);
  const into = total - totalXpForLevel(level);
  const needed = xpToNext(level);
  return { level, into, needed, percent: level >= MAX_LEVEL ? 100 : Math.min(100, Math.floor((into / needed) * 100)), total };
}

/** Replaces {user} {username} {level}. Unknown placeholders stay as typed. The caller decides what the values look like (the bot escapes them). */
export function fillLevelTemplate(template: string, values: { user: string; username: string; level: string }): string {
  return template.replace(/\{(user|username|level)\}/g, (_, key: "user" | "username" | "level") => values[key]);
}

const snowflake = z.string().regex(/^\d{17,20}$/);
const idList = z
  .array(snowflake)
  .max(MAX_NO_XP)
  .refine((ids) => new Set(ids).size === ids.length, "duplicate");

export const levelSettingsSchema = z
  .object({
    enabled: z.boolean(),
    xpMin: z.number().int().min(1).max(100),
    xpMax: z.number().int().min(1).max(100),
    cooldownSeconds: z.number().int().min(0).max(3600),
    voiceXpPerMinute: z.number().int().min(0).max(50),
    announce: z.enum(ANNOUNCE_MODES),
    /** "" = none. */
    announceChannelId: z.union([z.literal(""), snowflake]),
    announceTemplate: z.string().trim().min(1).max(MAX_ANNOUNCE_TEMPLATE),
    noXpChannelIds: idList,
    noXpRoleIds: idList,
    stackRoles: z.boolean(),
    rewards: z
      .array(z.object({ level: z.number().int().min(1).max(MAX_LEVEL), roleId: snowflake }))
      .max(MAX_REWARDS),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.xpMax < v.xpMin) issue("xpMax", "range");
    if (v.announce === "channel" && !v.announceChannelId) issue("announceChannelId", "needsChannel");
    const levels = new Set<string | number>();
    const roles = new Set<string>();
    for (const r of v.rewards) {
      if (levels.has(r.level)) issue("rewards", "duplicateLevel");
      if (roles.has(r.roleId)) issue("rewards", "duplicateRole");
      levels.add(r.level);
      roles.add(r.roleId);
    }
  });
export type LevelSettings = z.infer<typeof levelSettingsSchema>;
