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

/** The readable text of a page. An invalid or unmatched selector falls back to <main>, <article> or the whole body. */
export function htmlToText(html: string, selector?: string | null): string {
  const root = parse(html.slice(0, 3_000_000));
  root.querySelectorAll(DROP).forEach((n) => n.remove());
  let scope: HTMLElement | null = null;
  if (selector && selector.trim() !== "") {
    try {
      scope = root.querySelector(selector.trim());
    } catch {
      scope = null; // a bad selector must not break the fetch
    }
  }
  scope ??= root.querySelector("main") ?? root.querySelector("article") ?? root.querySelector("body") ?? root;
  const out: string[] = [];
  walk(scope, out);
  return out
    .join("")
    .replace(/[\t\u00a0 ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_PAGE_CHARS);
}
