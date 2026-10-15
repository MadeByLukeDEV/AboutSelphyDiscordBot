import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { getText } from "../../lib/safe-http";

// Gets a game's article page. A plain request first; if the site blocks it (a bot wall) or the admin asked for it, the optional Crawl4AI service
// (a headless browser on the private network) tries. The address template is filled for this month and the next ("this-month-october2026").

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MAX_BYTES = 3_000_000;
const BROWSER_HEADERS = {
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (compatible; AboutSelphyBot/1.0; +https://www.aboutselphy.com)",
};

/** Fills {month} (english name, lower case), {mm} and {year} for a date. */
export function expandTemplate(template: string, date: Date): string {
  const m = date.getUTCMonth();
  return template.replaceAll("{month}", MONTHS[m]!).replaceAll("{mm}", String(m + 1).padStart(2, "0")).replaceAll("{year}", String(date.getUTCFullYear()));
}

/** The addresses to look at: this month's and next month's (just one when the template has no date in it). */
export function pageUrlsFor(template: string, now: Date): string[] {
  const urls = [0, 1].map((add) => expandTemplate(template, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + add, 1))));
  return [...new Set(urls)];
}

export type PageResult = { ok: true; html: string; via: "plain" | "crawl4ai" } | { ok: false; status: "notPublished" | "blocked" | "failed" | "crawl4ai" };

/** Does the answer look like a bot wall or an error page instead of the article? */
export const looksBlocked = (status: number, body: string): boolean => status === 401 || status === 403 || status === 429 || status === 503 || /just a moment|attention required|access denied|enable javascript and cookies|verify you are human/i.test(body.slice(0, 4000)) && body.length < 20_000;

type CrawlResult = { html?: unknown; cleaned_html?: unknown; fit_html?: unknown; status_code?: unknown };

/** Is this the site's own "page not found" page (some sites answer 200, or the browser service hides the status)? */
export const looksNotFound = (html: string): boolean => /<title[^>]*>[^<]{0,120}(404|page not found|not found)[^<]{0,120}<\/title>/i.test(html.slice(0, 20_000));

/** One page through the Crawl4AI service. Null when it isn't configured or can't deliver. The API answer is read defensively (versions differ). */
async function viaCrawl4ai(url: string): Promise<{ html: string; status: number | null } | null> {
  const { CRAWL4AI_URL, CRAWL4AI_TOKEN } = env();
  if (!CRAWL4AI_URL) return null;
  const base = CRAWL4AI_URL.replace(/\/+$/, "");
  const headers: Record<string, string> = { "content-type": "application/json", ...(CRAWL4AI_TOKEN ? { authorization: `Bearer ${CRAWL4AI_TOKEN}` } : {}) };
  try {
    const res = await fetch(`${base}/crawl`, { method: "POST", headers, body: JSON.stringify({ urls: [url] }), signal: AbortSignal.timeout(90_000) });
    if (!res.ok) {
      log.warn({ status: res.status }, "eventcal: the browser service refused the request");
      return null;
    }
    const body = (await res.json().catch(() => null)) as { results?: CrawlResult[]; html?: unknown } | null;
    const first = body?.results?.[0];
    const html = first?.html ?? first?.cleaned_html ?? first?.fit_html ?? body?.html;
    if (typeof html !== "string" || html.length <= 200 || html.length > 6_000_000) return null;
    return { html, status: typeof first?.status_code === "number" ? first.status_code : null };
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.name : "error" }, "eventcal: the browser service could not be reached");
    return null;
  }
}

/** Fetches one page. `mode`: auto (plain, then the browser service if blocked), plain, or crawl4ai. */
export async function fetchPage(url: string, mode: string): Promise<PageResult> {
  if (mode !== "crawl4ai") {
    const res = await getText(url, { maxBytes: MAX_BYTES, timeoutMs: 20_000, headers: BROWSER_HEADERS });
    if (res.ok && res.status >= 200 && res.status < 300 && !looksBlocked(res.status, res.body)) return { ok: true, html: res.body, via: "plain" };
    if (res.ok && res.status === 404) return { ok: false, status: "notPublished" };
    const blocked = !res.ok ? false : looksBlocked(res.status, res.body);
    if (!blocked || mode === "plain") return { ok: false, status: blocked ? "blocked" : "failed" };
  }
  const page = await viaCrawl4ai(url);
  // An article that isn't published yet answers 404 (or shows the site's not-found page): that is "not yet", not an error.
  if (page && (page.status === 404 || page.status === 410 || looksNotFound(page.html))) return { ok: false, status: "notPublished" };
  const html = page?.html;
  return html ? { ok: true, html, via: "crawl4ai" } : { ok: false, status: mode === "crawl4ai" || env().CRAWL4AI_URL ? "crawl4ai" : "blocked" };
}
