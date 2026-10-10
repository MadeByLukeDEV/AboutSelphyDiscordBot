import { z } from "zod";

// What a role panel may contain. One definition for the dashboard (form and Server
// Action); the bot re-checks everything before it posts. Pure and free of Node APIs.
// Import it from "@aboutselphy/shared/role-panel".

export const MAX_PANEL_ROLES = 25; // a select menu's limit, and 5 rows of 5 buttons
export const MAX_LABEL = 80;
export const MAX_ROLE_DESCRIPTION = 100;
export const MAX_PANEL_TITLE = 256;
export const MAX_PANEL_DESCRIPTION = 2000;
export const DEFAULT_PANEL_COLOR = 0x00ffa8;

export const PANEL_STYLES = ["buttons", "menu"] as const;
export type PanelStyle = (typeof PANEL_STYLES)[number];

const snowflake = z.string().regex(/^\d{17,20}$/);

/** A unicode emoji (also flags and skin tones) or nothing. Custom emoji are not supported. */
export function isUnicodeEmoji(value: string): boolean {
  if (value === "") return true;
  if (value.length > 32) return false;
  return /^(?:\p{Regional_Indicator}{2}|[\p{Extended_Pictographic}‍️⃣\u{1F3FB}-\u{1F3FF}0-9#*]+)$/u.test(value) && /\p{Emoji}/u.test(value);
}

export const panelRoleInput = z.object({
  roleId: snowflake,
  label: z.string().trim().min(1).max(MAX_LABEL),
  emoji: z.string().max(32).refine(isUnicodeEmoji, "emoji"),
  description: z.string().trim().max(MAX_ROLE_DESCRIPTION),
});
export type PanelRoleInput = z.infer<typeof panelRoleInput>;

export const rolePanelInput = z
  .object({
    id: z.string().min(1).max(64).optional(),
    channelId: snowflake,
    title: z.string().trim().max(MAX_PANEL_TITLE),
    description: z.string().trim().max(MAX_PANEL_DESCRIPTION),
    color: z.number().int().min(0).max(0xffffff),
    style: z.enum(PANEL_STYLES),
    exclusive: z.boolean(),
    roles: z.array(panelRoleInput).min(1).max(MAX_PANEL_ROLES),
    /** Post (or update the posted message) right after saving. */
    publish: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.title === "" && v.description === "") ctx.addIssue({ code: "custom", path: ["title"], message: "empty" });
    const seen = new Set<string>();
    v.roles.forEach((r, i) => {
      if (seen.has(r.roleId)) ctx.addIssue({ code: "custom", path: ["roles", i, "roleId"], message: "duplicate" });
      seen.add(r.roleId);
    });
  });
export type RolePanelInput = z.infer<typeof rolePanelInput>;
