import { withEmotes } from "../../lib/emotes";
import { EmbedBuilder } from "discord.js";
import { isAllowedImageUrl } from "@aboutselphy/shared/announcement";
import { fillWelcome } from "@aboutselphy/shared/welcome";
import { escapeText, truncate } from "../../lib/escape";

// The welcome, direct and goodbye texts. A username or server name is chosen by strangers, so
// it is escaped; {user} becomes a real mention of the member who just joined, and only that
// member can be pinged (the message's allowedMentions lists exactly them).

export type MemberFacts = { id: string; username: string; serverName: string; memberCount: number };

export function renderWelcome(template: string, who: MemberFacts, mention = true): string {
  return withEmotes(fillWelcome(template, {
    user: mention ? `<@${who.id}>` : escapeText(who.username),
    username: escapeText(who.username),
    server: escapeText(who.serverName),
    count: String(who.memberCount),
  }));
}

export type WelcomeLook = { asEmbed: boolean; color: number; imageUrl: string };

export const CARD_FILE_NAME = "welcome-card.png";

/**
 * Which of the saved welcome texts to use: random, but never the same one twice in a row when there
 * is a choice. `random` is injected so the rule is testable.
 */
export function pickTemplate(templates: string[], lastIndex: number | null, random: () => number = Math.random): { index: number; text: string } | null {
  if (templates.length === 0) return null;
  if (templates.length === 1) return { index: 0, text: templates[0]! };
  const choices = templates.map((_, i) => i).filter((i) => i !== lastIndex);
  const index = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]!;
  return { index, text: templates[index]! };
}

/**
 * The post in the welcome channel: plain text, or a box with the same text (the mention stays in the
 * plain content so it pings). With a card, the picture is attached and, in a box, shown in it.
 */
export function welcomeMessage(template: string, who: MemberFacts, look: WelcomeLook, card: Uint8Array | null = null) {
  const text = truncate(renderWelcome(template, who), 4000);
  const allowedMentions = { parse: [] as never[], users: [who.id] };
  const files = card ? [{ attachment: Buffer.from(card), name: CARD_FILE_NAME }] : [];
  if (!look.asEmbed) return { content: truncate(text, 2000), embeds: [] as EmbedBuilder[], allowedMentions, files };

  const embed = new EmbedBuilder().setColor(look.color).setDescription(text);
  // Re-checked here: the row is trusted, but a bad address must never reach Discord.
  // The member's own card wins over the fixed picture.
  if (card) embed.setImage(`attachment://${CARD_FILE_NAME}`);
  else if (look.imageUrl && isAllowedImageUrl(look.imageUrl)) embed.setImage(look.imageUrl);
  // A mention inside a box doesn't ping, so the member is also mentioned above it.
  return { content: `<@${who.id}>`, embeds: [embed], allowedMentions, files };
}

/** The direct message: no mention needed, it already is addressed to them. */
export function dmText(template: string, who: MemberFacts): string {
  return truncate(renderWelcome(template, who, false), 2000);
}

/** The goodbye line: the name, never a mention (the member is gone), and nobody is pinged. */
export function goodbyeMessage(template: string, who: MemberFacts) {
  return { content: truncate(renderWelcome(template, who, false), 2000), allowedMentions: { parse: [] as never[] } };
}

/**
 * The roles worth remembering when a member leaves: everything except @everyone and the roles
 * an integration manages (those come back by themselves). Whether a role may be handed out
 * again is decided when the member returns, not now.
 */
export function rolesToSnapshot(roles: Array<{ id: string; managed: boolean }>, everyoneId: string): string[] {
  return roles.filter((r) => r.id !== everyoneId && !r.managed).map((r) => r.id);
}

/** The roles to give a member on arrival: the auto-roles and the restored ones, without repeats and without what they already have. */
export function rolesOnJoin(input: { auto: string[]; restored: string[]; already: ReadonlySet<string> }): string[] {
  return [...new Set([...input.auto, ...input.restored])].filter((id) => !input.already.has(id));
}
