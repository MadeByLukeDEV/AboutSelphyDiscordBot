"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { GuildEmoji } from "@aboutselphy/shared";
import { customEmojiUrl } from "@aboutselphy/shared/role-panel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StandardEmoji = { emoji: string; name: string; slug: string };
type StandardGroup = { name: string; slug: string; emojis: StandardEmoji[] };

const GROUP_ICONS: Record<string, string> = {
  smileys_emotion: "😀",
  people_body: "🧑",
  animals_nature: "🐻",
  food_drink: "🍔",
  travel_places: "🌍",
  activities: "⚽",
  objects: "💡",
  symbols: "🔣",
  flags: "🏁",
};

const MAX_SEARCH_RESULTS = 240;

/**
 * Picks an emoji: the server's own emotes first, then the standard emoji by category, with a
 * search over both. The standard list is loaded the first time the picker opens (about 400 KB of
 * data), so it costs nothing until someone uses it. `onPick` gets the text to store: a character
 * for a standard emoji, "<:name:id>" for a server emote.
 */
export function EmojiPicker({ emojis, onPick }: { emojis: GuildEmoji[] | null; onPick: (value: string) => void }) {
  const t = useTranslations("Roles.picker");
  const [groups, setGroups] = useState<StandardGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const hasServer = (emojis?.length ?? 0) > 0;
  const [tab, setTab] = useState<string>(hasServer ? "server" : "smileys_emotion");

  useEffect(() => {
    let cancelled = false;
    import("unicode-emoji-json/data-by-group.json")
      .then((m) => {
        if (!cancelled) setGroups((m.default ?? m) as unknown as StandardGroup[]);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const needle = query.trim().toLowerCase().replace(/^:|:$/g, "");
  const searching = needle.length > 0;

  const results = useMemo(() => {
    if (!searching) return null;
    const server = (emojis ?? []).filter((e) => e.name.toLowerCase().includes(needle));
    const standard: StandardEmoji[] = [];
    for (const g of groups ?? []) {
      for (const e of g.emojis) {
        if (e.name.toLowerCase().includes(needle) || e.slug.includes(needle.replaceAll(" ", "_"))) standard.push(e);
        if (standard.length >= MAX_SEARCH_RESULTS) break;
      }
    }
    return { server, standard };
  }, [searching, needle, emojis, groups]);

  const group = groups?.find((g) => g.slug === tab);

  const serverButton = (e: GuildEmoji) => (
    <li key={e.id}>
      <button
        type="button"
        title={`:${e.name}:`}
        aria-label={`:${e.name}:`}
        className="flex size-10 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => onPick(e.value)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a small emote from Discord's CDN (allowed by the CSP) */}
        <img src={customEmojiUrl(e.id, e.animated, 32)} alt="" className="size-7" loading="lazy" />
      </button>
    </li>
  );

  const standardButton = (e: StandardEmoji) => (
    <li key={e.slug}>
      <button
        type="button"
        title={e.name}
        aria-label={e.name}
        className="flex size-10 items-center justify-center rounded-md text-2xl hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => onPick(e.emoji)}
      >
        <span aria-hidden>{e.emoji}</span>
      </button>
    </li>
  );

  const grid = "grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1";

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-2">
      <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} autoComplete="off" />

      {!searching && (
        <div role="tablist" aria-label={t("categories")} className="flex gap-1 overflow-x-auto pb-1">
          {hasServer && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "server"}
              className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-medium", tab === "server" ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent")}
              onClick={() => setTab("server")}
            >
              {t("server", { count: emojis?.length ?? 0 })}
            </button>
          )}
          {(groups ?? []).map((g) => (
            <button
              key={g.slug}
              type="button"
              role="tab"
              aria-selected={tab === g.slug}
              aria-label={g.name}
              title={g.name}
              className={cn("shrink-0 rounded-md px-2 py-1 text-base", tab === g.slug ? "bg-primary/15" : "hover:bg-accent")}
              onClick={() => setTab(g.slug)}
            >
              <span aria-hidden>{GROUP_ICONS[g.slug] ?? g.emojis[0]?.emoji}</span>
            </button>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto" aria-live="polite">
        {failed && <p className="p-2 text-sm text-muted-foreground">{t("loadFailed")}</p>}
        {!failed && groups === null && <p className="p-2 text-sm text-muted-foreground">{t("loading")}</p>}

        {results ? (
          results.server.length + results.standard.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {results.server.length > 0 && (
                <>
                  <p className="px-1 text-xs font-medium text-muted-foreground">{t("serverHeading")}</p>
                  <ul className={grid}>{results.server.map(serverButton)}</ul>
                </>
              )}
              {results.standard.length > 0 && (
                <>
                  <p className="px-1 text-xs font-medium text-muted-foreground">{t("standardHeading")}</p>
                  <ul className={grid}>{results.standard.map(standardButton)}</ul>
                </>
              )}
            </div>
          )
        ) : tab === "server" ? (
          <ul className={grid}>{(emojis ?? []).map(serverButton)}</ul>
        ) : group ? (
          <ul className={grid}>{group.emojis.map(standardButton)}</ul>
        ) : null}
      </div>
    </div>
  );
}
