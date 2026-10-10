// The announcement text template, shared by the bot (which sends it) and the
// dashboard (which previews it), so the preview can't drift from what is posted.
// Pure and free of Node APIs: safe in client components. Import it from
// "@aboutselphy/shared/twitch-template", not from the package index.

export const TEMPLATE_PLACEHOLDERS = ["name", "login", "title", "game", "url"] as const;
export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

export const MAX_TEMPLATE_LENGTH = 300;
export const DEFAULT_TEMPLATE = "{name} is live: {title}";

/** Twitch purple. */
export const DEFAULT_EMBED_COLOR = 0x9146ff;

export function twitchChannelUrl(login: string): string {
  return `https://twitch.tv/${encodeURIComponent(login)}`;
}

/**
 * Replaces {name} {login} {title} {game} {url}. Unknown placeholders stay as typed.
 * The caller decides what the values look like: the bot passes escaped text.
 */
export function fillTemplate(template: string, values: Record<TemplatePlaceholder, string>): string {
  return template.replace(/\{(name|login|title|game|url)\}/g, (_, key: TemplatePlaceholder) => values[key]);
}

/** 24-bit colour number to "#rrggbb". */
export function colorToHex(color: number): string {
  return `#${Math.min(0xffffff, Math.max(0, Math.trunc(color))).toString(16).padStart(6, "0")}`;
}

/** "#rrggbb" or "rrggbb" to a 24-bit number, or undefined if it isn't one. */
export function hexToColor(hex: string): number | undefined {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return match ? Number.parseInt(match[1]!, 16) : undefined;
}
