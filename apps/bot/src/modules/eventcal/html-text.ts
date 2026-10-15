import { parse, type HTMLElement, type Node } from "node-html-parser";

// Turns a fetched web page into plain text for the extraction: scripts, menus and forms removed, headings and paragraphs on their own lines.
// Optionally narrowed by a CSS selector the admin set for that site. Pure, tested with real-looking markup.

export const MAX_PAGE_CHARS = 40_000;
const DROP = "script,style,noscript,svg,nav,header,footer,form,iframe,template";
const BLOCK = new Set(["p", "div", "section", "article", "main", "ul", "ol", "table", "blockquote", "figure"]);
// Lines inside a block: one line break after each, none before (so a list stays tight).
const LINE = new Set(["li", "tr", "br", "figcaption"]);
const HEADING = /^h[1-6]$/;

function walk(node: Node, out: string[]): void {
  if (node.nodeType === 3) {
    out.push(node.text);
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as HTMLElement;
  const tag = (el.tagName ?? "").toLowerCase();
  const para = HEADING.test(tag) || BLOCK.has(tag);
  if (para) out.push("\n\n");
  for (const child of el.childNodes) walk(child, out);
  if (para) out.push("\n\n");
  else if (LINE.has(tag)) out.push("\n");
}

const MIN_USEFUL = 200;
const ALWAYS_DROP = "script,style,noscript,svg,template";

function clean(out: string[]): string {
  return out
    .join("")
    .replace(/[\t\u00a0 ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_PAGE_CHARS);
}

/** The text inside the first scope that holds enough of it: the admin's selector, then <main>, <article>, the body. */
function readScopes(root: HTMLElement, selector: string | null | undefined): string {
  const scopes: HTMLElement[] = [];
  if (selector && selector.trim() !== "") {
    try {
      const picked = root.querySelector(selector.trim());
      if (picked) {
        // The admin chose this part of the page: use it as it is, however short.
        const out: string[] = [];
        walk(picked, out);
        return clean(out);
      }
    } catch {
      // a bad selector must not break the fetch
    }
  }
  for (const css of ["main", "article", "body"]) {
    const found = root.querySelector(css);
    if (found) scopes.push(found);
  }
  scopes.push(root);
  let best = "";
  for (const scope of scopes) {
    const out: string[] = [];
    walk(scope, out);
    const text = clean(out);
    if (text.length >= MIN_USEFUL) return text;
    if (text.length > best.length) best = text;
  }
  return best;
}

/**
 * The readable text of a page. Menus, forms and footers are dropped first; if that leaves too little (some sites wrap the article in a form or a
 * header), a second pass keeps everything except scripts and styles. An invalid or unmatched selector is skipped.
 */
export function htmlToText(html: string, selector?: string | null): string {
  const source = html.slice(0, 3_000_000);
  const strict = parse(source);
  strict.querySelectorAll(DROP).forEach((n) => n.remove());
  const first = readScopes(strict, selector);
  if (first.length >= MIN_USEFUL) return first;
  const loose = parse(source);
  loose.querySelectorAll(ALWAYS_DROP).forEach((n) => n.remove());
  const second = readScopes(loose, selector);
  // The looser reading only wins when it finds a real article; a page that is short anyway keeps the clean version.
  return second.length >= MIN_USEFUL ? second : first;
}
