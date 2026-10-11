import { escapeText, truncate } from "../../lib/escape";
import type { FeedItemData } from "./parse";

// What gets announced and what it says. Pure, so the rules are testable.

/** Items older than this are remembered but never announced as new (a feed that was empty for a while, an old backlog). */
export const MAX_AGE_MS = 48 * 3_600_000;
/** More new items than this at once are almost always a backlog or a reset feed: the rest are remembered silently. */
export const MAX_POSTS_PER_CHECK = 5;

export type Selection = { toPost: FeedItemData[]; toRemember: FeedItemData[] };

/**
 * Which unseen items to announce. Oldest first, only fresh ones (a missing date counts as fresh), at most
 * MAX_POSTS_PER_CHECK; every other unseen item is only remembered.
 */
export function selectNew(items: readonly FeedItemData[], seen: ReadonlySet<string>, now: Date): Selection {
  const unseen = items.filter((i) => !seen.has(i.guid));
  const fresh = unseen.filter((i) => i.publishedAt === null || now.getTime() - i.publishedAt.getTime() <= MAX_AGE_MS);
  // Oldest first so the channel reads in order; items without a date keep the feed's order (newest first), reversed.
  const ordered = [...fresh].reverse().sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));
  const toPost = ordered.slice(-MAX_POSTS_PER_CHECK);
  const posted = new Set(toPost.map((i) => i.guid));
  return { toPost, toRemember: unseen.filter((i) => !posted.has(i.guid)) };
}

/** Only an http(s) link without spaces is ever shown. */
export const safeLink = (link: string): string => (/^https?:\/\/[^\s<>]+$/.test(link) ? link : "");

/** Fills {name} and {title} (escaped, so a title can't ping or format) and {link} (plain, so Discord shows a preview). */
export function renderFeedMessage(template: string, item: { name: string; title: string; link: string }): string {
  const text = template
    .split(/(\{name\}|\{title\}|\{link\})/)
    .map((part) => (part === "{name}" ? escapeText(truncate(item.name, 60)) : part === "{title}" ? escapeText(truncate(item.title, 250)) : part === "{link}" ? safeLink(item.link) : escapeText(part)))
    .join("")
    .replace(/[ \t]+/g, " ")
    .trim();
  return truncate(text, 1900);
}

/** Is a feed due for its next check? */
export function isDue(feed: { lastCheckedAt: Date | null; intervalMinutes: number }, now: Date): boolean {
  return feed.lastCheckedAt === null || now.getTime() - feed.lastCheckedAt.getTime() >= feed.intervalMinutes * 60_000;
}
