import { z } from "zod";
import { parseCalendar, type CalEvent } from "./ics";
import { getText } from "../../lib/safe-http";
import { aiConfigured } from "../../lib/ai";
import { log } from "../../lib/log";
import type { ArticleEvent } from "@aboutselphy/shared/eventcal-article";
import { contentHash, extractEvents } from "./extract";
import { fetchPage, pageUrlsFor } from "./fetcher";
import { htmlToText } from "./html-text";
import { itemKey } from "@aboutselphy/shared/eventcal";
import { ensureItems, listArticles, markVanished, readFetch, saveFetch, saveState, upsertEvent, type SourceState } from "./repository";
import { mergeArticle } from "./rules";
import { toRow } from "./store";

// Brings one source's stored events up to date: the calendar feed, the fetched pages and the pasted articles are read, merged, and written to
// the database. A failed read never removes anything: the stored events keep serving the posts until the next try.

const DAY = 86_400_000;
const MAX_ICS_BYTES = 4_000_000;

const storedSchema = z.array(
  z.object({
    title: z.string(),
    start: z.coerce.date().nullable(),
    end: z.coerce.date().nullable(),
    everyWeekday: z.number().nullable(),
    text: z.string(),
    categories: z.array(z.string()),
    image: z.string().nullable(),
    video: z.string().nullable(),
    kind: z.enum(["drop", "event", "update", "sale", "other"]).optional(),
    items: z.array(z.string()).optional(),
    summary: z.string().optional(),
    blurb: z.string().optional(),
    audience: z.enum(["everyone", "partners", "unknown"]).optional(),
  }),
);

/** The article events of a text: from the cache when the text is unchanged, else extracted (one AI call) and cached. */
async function articleEvents(src: SourceState, url: string, text: string, now: Date, used: { plain: boolean }): Promise<ArticleEvent[]> {
  const hash = contentHash(text, src.name);
  const cached = await readFetch(src.id, url);
  // A plain-parser result is only final while there is no AI to try again with.
  if (cached && cached.contentHash === hash && (cached.status === "ai" || !aiConfigured())) {
    try {
      const events = storedSchema.parse(JSON.parse(cached.extractedJson)) as ArticleEvent[];
      if (cached.status !== "ai" && aiConfigured()) used.plain = true;
      return events;
    } catch {
      // a damaged cache row: extract again
    }
  }
  const { events, via } = await extractEvents(text, src.name, now);
  if (via === "heuristic" && aiConfigured()) used.plain = true;
  await saveFetch(src.id, url, { contentHash: hash, extractedJson: JSON.stringify(events), status: via }).catch((err) => log.warn({ err }, "eventcal: could not cache the extraction"));
  return events;
}

export type SyncResult = { status: string; events: number };

/** Reads every input of the source and updates its stored events. The source is marked as "fetching" meanwhile, so the dashboard can say so. */
export async function syncSource(src: SourceState, now = new Date()): Promise<SyncResult> {
  await saveState(src.id, { syncStartedAt: new Date() }).catch(() => undefined);
  try {
    return await syncInner(src, now);
  } finally {
    await saveState(src.id, { syncStartedAt: null }).catch(() => undefined);
  }
}

async function syncInner(src: SourceState, now: Date): Promise<SyncResult> {
  const from = new Date(now.getTime() - 2 * DAY);
  const to = new Date(now.getTime() + 120 * DAY);
  let status = "ok";
  let allOk = true;
  const fail = (code: string) => {
    allOk = false;
    if (status === "ok") status = code;
  };

  let calendar: CalEvent[] = [];
  if (src.icsUrl) {
    const res = await getText(src.icsUrl, { maxBytes: MAX_ICS_BYTES, timeoutMs: 20_000 });
    if (!res.ok) fail(res.detail ? `${res.reason}: ${res.detail}`.slice(0, 40) : res.reason);
    else if (res.status < 200 || res.status >= 300) fail(`http ${res.status}`);
    else {
      try {
        calendar = parseCalendar(res.body, from, to);
      } catch {
        fail("parse");
      }
    }
  }

  const articles: ArticleEvent[] = [];
  // Set when the AI is configured but its answer wasn't usable, so the dashboard can say the plain parser was used.
  const used = { plain: false };
  if (src.pageUrlTemplate) {
    for (const url of pageUrlsFor(src.pageUrlTemplate, now)) {
      const page = await fetchPage(url, src.fetchMode);
      if (!page.ok) {
        if (page.status !== "notPublished") fail(page.status);
        continue;
      }
      const text = htmlToText(page.html, src.contentSelector);
      log.info({ source: src.name, url, via: page.via, htmlChars: page.html.length, textChars: text.length }, "eventcal: page read");
      if (text.length < 200) {
        // Shows what the page text looked like, so a selector can be chosen (the page is public).
        log.warn({ source: src.name, url, head: text.slice(0, 300), htmlHead: page.html.replace(/<head[\s\S]*?<\/head>/i, "").slice(0, 400) }, "eventcal: the page had too little readable text");
        fail("emptyPage");
        continue;
      }
      articles.push(...(await articleEvents(src, url, text, now, used)));
    }
  }
  for (const pasted of await listArticles(src.id)) articles.push(...(await articleEvents(src, `paste:${pasted.id}`, pasted.text, now, used)));

  const merged = mergeArticle(calendar, articles, from, to);
  const hasInputs = Boolean(src.icsUrl || src.pageUrlTemplate) || articles.length > 0;
  if (merged.length === 0) {
    const result = { status: allOk ? (hasInputs ? "empty" : "noSource") : status, events: 0 };
    await saveState(src.id, { lastFetchedAt: now, lastFetchStatus: result.status.slice(0, 40) });
    return result;
  }

  const seen: string[] = [];
  for (const e of merged) {
    const row = toRow(e);
    seen.push(row.key);
    await upsertEvent(src.id, e.key.startsWith("article|") ? "article" : "calendar", row);
  }
  // Every item name becomes a row of the game's item library, ready for a picture.
  const seenItems = new Map<string, string>();
  for (const e of merged) for (const name of e.items ?? []) if (!seenItems.has(itemKey(name))) seenItems.set(itemKey(name), name);
  await ensureItems(src.id, [...seenItems].map(([key, name]) => ({ key, name }))).catch((err) => log.warn({ err }, "eventcal: could not update the item library"));
  // Only a read that fully succeeded may declare an event gone.
  if (allOk) {
    const gone = await markVanished(src.id, seen, from, to);
    if (gone.count > 0) log.info({ source: src.name, removed: gone.count }, "eventcal: events no longer in the sources were marked removed");
  }
  if (status === "ok" && used.plain) status = "ok (no AI)";
  await saveState(src.id, { lastFetchedAt: now, lastFetchStatus: status.slice(0, 40) });
  log.info({ source: src.name, events: merged.length, status }, "eventcal: synced");
  return { status, events: merged.length };
}

