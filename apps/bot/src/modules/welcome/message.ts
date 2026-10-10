import { EmbedBuilder } from "discord.js";
import { isAllowedImageUrl } from "@aboutselphy/shared/announcement";
import { fillWelcome } from "@aboutselphy/shared/welcome";
import { escapeText, truncate } from "../../lib/escape";

// The welcome, direct and goodbye texts. A username or server name is chosen by strangers, so
// it is escaped; {user} becomes a real mention of the member who just joined, and only that
// member can be pinged (the message's allowedMentions lists exactly them).

export type MemberFacts = { id: string; username: string; serverName: string; memberCount: number };

export function renderWelcome(template: string, who: MemberFacts, mention = true): string {
  return fillWelcome(template, {
    user: mention ? `<@${who.id}>` : escapeText(who.username),
    username: escapeText(who.username),
    server: escapeText(who.serverName),
    count: String(who.memberCount),
  });
}

export type WelcomeLook = { asEmbed: boolean; color: number; imageUrl: string };

/** The post in the welcome channel: plain text, or a box with the same text (the mention stays in the plain content so it pings). */
export function welcomeMessage(template: string, who: MemberFacts, look: WelcomeLook) {
  const text = truncate(renderWelcome(template, who), 4000);
  const allowedMentions = { parse: [] as never[], users: [who.id] };
  if (!look.asEmbed) return { content: truncate(text, 2000), embeds: [] as EmbedBuilder[], allowedMentions };

  const embed = new EmbedBuilder().setColor(look.color).setDescription(text);
  // Re-checked here: the row is trusted, but a bad address must never reach Discord.
  if (look.imageUrl && isAllowedImageUrl(look.imageUrl)) embed.setImage(look.imageUrl);
  // A mention inside a box doesn't ping, so the member is also mentioned above it.
  return { content: `<@${who.id}>`, embeds: [embed], allowedMentions };
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
