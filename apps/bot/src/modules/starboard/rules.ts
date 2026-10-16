import { EmbedBuilder } from "discord.js";
import { customEmoteId, normalizeEmoji } from "@aboutselphy/shared/starboard";
import { escapeText, truncate } from "../../lib/escape";

// What counts as a star and what the re-post looks like. Pure, so the rules are testable. The
// message text is escaped (it can't ping or link) and the author is shown as a mention plus name.

/** Does a reaction's emoji match the configured one? A unicode emoji by its characters, a server emote by its id (its name may change). */
export function isStarEmoji(configured: string, reaction: { id: string | null; name: string | null }): boolean {
  const wanted = customEmoteId(configured);
  if (wanted !== null) return reaction.id === wanted;
  return reaction.id === null && reaction.name !== null && normalizeEmoji(reaction.name) === normalizeEmoji(configured);
}

/** The people who count: no bots, and not the author unless allowed. Each person once. */
export function countStars(reactorIds: Iterable<string>, opts: { authorId: string; allowSelf: boolean; botIds?: ReadonlySet<string> }): number {
  const seen = new Set<string>();
  for (const id of reactorIds) {
    if (opts.botIds?.has(id)) continue;
    if (!opts.allowSelf && id === opts.authorId) continue;
    seen.add(id);
  }
  return seen.size;
}

export type Decision = "post" | "update" | "remove" | "none";

/** What to do with the re-post given the current star count. */
export function decide(stars: number, threshold: number, hasPost: boolean): Decision {
  if (stars >= threshold) return hasPost ? "update" : "post";
  return hasPost ? "remove" : "none";
}

/** The emoji grows with the count, like the usual starboards. */
export function medal(stars: number): string {
  return stars >= 20 ? "\u{1F31F}" : stars >= 10 ? "\u{1F4AB}" : "\u2B50";
}

export type StarView = {
  emoji: string;
  stars: number;
  channelId: string;
  jumpUrl: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl: string | null;
  attachmentCount: number;
  at: Date;
};

export function buildStarMessage(v: StarView) {
  const body = v.content.trim();
  const description = [body ? truncate(escapeText(body), 3500) : "", v.attachmentCount > 1 ? `*${v.attachmentCount} attachments*` : "", `[Jump to message](${v.jumpUrl})`].filter(Boolean).join("\n\n");
  const embed = new EmbedBuilder()
    .setColor(0xffc83d)
    .setAuthor({ name: truncate(v.authorName, 80) })
    .setDescription(description)
    .setTimestamp(v.at);
  if (v.imageUrl) embed.setImage(v.imageUrl);
  return {
    content: `${v.emoji} **${v.stars}** | <#${v.channelId}>`,
    embeds: [embed],
    allowedMentions: { parse: [] as never[] },
  };
}

/** Only Discord's own CDN addresses are ever put into the embed image. */
export function safeImage(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "cdn.discordapp.com" || u.hostname === "media.discordapp.net") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Is this channel (or its category) on the ignore list? */
export const isIgnoredChannel = (channelId: string, parentId: string | null, ignored: readonly string[]): boolean => ignored.includes(channelId) || (parentId !== null && ignored.includes(parentId));

/** The text for `/starboard random`: the saved facts about a starred message, escaped, nothing that can ping. */
export function randomPostText(p: { stars: number; authorId: string; excerpt: string; jumpUrl: string }, emoji: string): string {
  const quote = p.excerpt.trim() === "" ? "" : `\n> ${escapeText(p.excerpt).slice(0, 200)}`;
  return `${emoji} **${p.stars}** · by <@${p.authorId}>${quote}\n${p.jumpUrl}`;
}
