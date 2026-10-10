import { z } from "zod";

// What a role panel may contain. One definition for the dashboard (form and Server
// Action); the bot re-checks everything before it posts. Pure and free of Node APIs.
// Import it from "@aboutselphy/shared/role-panel".

export const MAX_PANEL_ROLES = 25; // a select menu's limit, and 5 rows of 5 buttons
/** Discord allows 20 different reactions on one message. */
export const MAX_REACTION_ROLES = 20;
export const MAX_LABEL = 80;
export const MAX_ROLE_DESCRIPTION = 100;
export const MAX_PANEL_TITLE = 256;
export const MAX_PANEL_DESCRIPTION = 2000;
export const DEFAULT_PANEL_COLOR = 0x00ffa8;

export const PANEL_STYLES = ["buttons", "menu", "reactions"] as const;
export type PanelStyle = (typeof PANEL_STYLES)[number];

const snowflake = z.string().regex(/^\d{17,20}$/);

/** A unicode emoji (also flags and skin tones) or nothing. */
export function isUnicodeEmoji(value: string): boolean {
  if (value === "") return true;
  if (value.length > 32) return false;
  return /^(?:\p{Regional_Indicator}{2}|[\p{Extended_Pictographic}\u200d\ufe0f\u20e3\u{1F3FB}-\u{1F3FF}0-9#*]+)$/u.test(value) && /\p{Emoji}/u.test(value);
}

/** One of the server's own emotes as Discord writes it: "<:name:id>" or "<a:name:id>" (animated). */
const CUSTOM_EMOJI = /^<(a?):([A-Za-z0-9_]{2,32}):(\d{17,20})>$/;

export type ParsedEmoji = { kind: "unicode"; name: string } | { kind: "custom"; id: string; name: string; animated: boolean };

/** Null for an empty value or something that is neither a unicode emoji nor a server emote. */
export function parseEmoji(value: string): ParsedEmoji | null {
  const custom = CUSTOM_EMOJI.exec(value);
  if (custom) return { kind: "custom", id: custom[3]!, name: custom[2]!, animated: custom[1] === "a" };
  return value !== "" && isUnicodeEmoji(value) ? { kind: "unicode", name: value } : null;
}

/** Empty, a unicode emoji or a server emote. */
export const isPanelEmoji = (value: string): boolean => value === "" || parseEmoji(value) !== null;

/** The image of a server emote on Discord's CDN. */
export function customEmojiUrl(id: string, animated: boolean, size = 64): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=${size}`;
}

export const panelRoleInput = z.object({
  roleId: snowflake,
  label: z.string().trim().min(1).max(MAX_LABEL),
  emoji: z.string().max(64).refine(isPanelEmoji, "emoji"),
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
    if (v.style === "reactions") {
      // A reaction is the control, so every role needs its own emoji, and at most 20 fit on a message.
      if (v.roles.length > MAX_REACTION_ROLES) ctx.addIssue({ code: "custom", path: ["roles"], message: "tooManyReactions" });
      const emojis = new Set<string>();
      v.roles.forEach((r, i) => {
        if (r.emoji === "") ctx.addIssue({ code: "custom", path: ["roles", i, "emoji"], message: "needsEmoji" });
        else if (emojis.has(r.emoji)) ctx.addIssue({ code: "custom", path: ["roles", i, "emoji"], message: "duplicateEmoji" });
        emojis.add(r.emoji);
      });
    }
    const seen = new Set<string>();
    v.roles.forEach((r, i) => {
      if (seen.has(r.roleId)) ctx.addIssue({ code: "custom", path: ["roles", i, "roleId"], message: "duplicate" });
      seen.add(r.roleId);
    });
  });
export type RolePanelInput = z.infer<typeof rolePanelInput>;
