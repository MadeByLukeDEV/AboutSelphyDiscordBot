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

const fold = (text: string): string => text.normalize("NFKC").toLowerCase();

/**
 * Does an item pass a feed's keyword filters? Words are plain text (never patterns), compared on the title (and the description when the caller passes it) after NFKC and lower case.
 * Any exclude word rejects; with include words at least one must be present.
 */
export function passesFilter(title: string, include: readonly string[], exclude: readonly string[], description = ""): boolean {
  const t = fold(description ? `${title} ${description}` : title);
  if (exclude.some((w) => w.trim() !== "" && t.includes(fold(w)))) return false;
  const wanted = include.filter((w) => w.trim() !== "");
  return wanted.length === 0 || wanted.some((w) => t.includes(fold(w)));
}

/** The embed variant of an announcement: the title links to the item, the source and the time sit on it. Escaped, nothing pings. */
export function feedEmbedData(feedName: string, item: { title: string; link: string; publishedAt: Date | null }): { title: string; url: string | undefined; footer: string; at: Date | null } {
  const link = safeLink(item.link);
  return { title: truncate(escapeText(item.title), 256) || "New item", url: link === "" ? undefined : link, footer: truncate(escapeText(feedName), 60), at: item.publishedAt };
}

/** One message for several new items: a heading and a bullet per item (escaped title, link only if http(s)); cut to Discord's limit. */
export function renderDigest(feedName: string, items: ReadonlyArray<{ title: string; link: string }>, ping: string): string {
  const head = `${ping}**${escapeText(truncate(feedName, 60))}**: ${items.length} new ${items.length === 1 ? "item" : "items"}`;
  const lines: string[] = [];
  let used = head.length;
  for (const [i, item] of items.entries()) {
    const link = safeLink(item.link);
    const line = `• ${escapeText(truncate(item.title, 150)) || "New item"}${link ? ` ${link}` : ""}`;
    // Keep room for the "and N more" line.
    if (used + line.length + 40 > 1900) {
      lines.push(`… and ${items.length - i} more`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return [head, ...lines].join("\n");
}
