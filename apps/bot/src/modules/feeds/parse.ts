import { XMLParser } from "fast-xml-parser";

// Reads an RSS 2.0 or Atom document into plain items. Feeds come from outside, so everything is
// treated as untrusted text: sizes are capped, odd shapes are skipped, and nothing is ever executed.
// The XML parser doesn't fetch external entities or resolve DTDs.

export type FeedItemData = { guid: string; title: string; link: string; publishedAt: Date | null; /** Plain text of the item's description or content (tags removed, cut), used only by the keyword filters. */ description?: string };

const MAX_ITEMS = 50;
const cut = (value: string, max: number) => value.slice(0, max);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

const arrayOf = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/** The text of a node that may be a string or an object with attributes ({"#text": ...}). */
function text(node: unknown): string {
  if (typeof node === "string") return node.trim();
  if (typeof node === "number") return String(node);
  if (node && typeof node === "object" && "#text" in node) return text((node as Record<string, unknown>)["#text"]);
  return "";
}

function atomLink(node: unknown): string {
  const links = arrayOf(node as Record<string, unknown> | string);
  for (const l of links) {
    if (typeof l === "string") return l.trim();
    if (!l || typeof l !== "object") continue;
    const attrs = l as Record<string, unknown>;
    const rel = text(attrs["@_rel"]);
    const href = attrs["@_href"];
    if ((rel === "" || rel === "alternate") && typeof href === "string") return href.trim();
  }
  const first = links[0];
  if (first && typeof first === "object") {
    const href = (first as Record<string, unknown>)["@_href"];
    return typeof href === "string" ? href.trim() : "";
  }
  return "";
}

/** Description text without markup, cut: it is only ever compared, never shown. */
function plain(value: string): string {
  return cut(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), 2000);
}

function date(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Items of a feed document, newest first as the feed lists them, at most 50. Throws if it isn't a feed. */
export function parseFeed(xml: string): FeedItemData[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const out: FeedItemData[] = [];

  const rss = doc["rss"] as { channel?: { item?: unknown } } | undefined;
  const atom = doc["feed"] as { entry?: unknown } | undefined;
  if (rss?.channel) {
    for (const raw of arrayOf(rss.channel.item as Record<string, unknown> | Record<string, unknown>[])) {
      const link = text(raw["link"]);
      const title = text(raw["title"]);
      const guid = text(raw["guid"]) || link || title;
      if (guid) out.push({ guid: cut(guid, 300), title: cut(title, 300), link: cut(link, 500), publishedAt: date(text(raw["pubDate"]) || text(raw["dc:date"])), description: plain(text(raw["description"]) || text(raw["content:encoded"])) });
    }
  } else if (atom) {
    for (const raw of arrayOf(atom.entry as Record<string, unknown> | Record<string, unknown>[])) {
      const link = atomLink(raw["link"]);
      const title = text(raw["title"]);
      const guid = text(raw["id"]) || link || title;
      if (guid) out.push({ guid: cut(guid, 300), title: cut(title, 300), link: cut(link, 500), publishedAt: date(text(raw["published"]) || text(raw["updated"])), description: plain(text(raw["summary"]) || text(raw["content"])) });
    }
  } else {
    throw new Error("not a feed");
  }
  return out.slice(0, MAX_ITEMS);
}
