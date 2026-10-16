"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CornerDownLeft, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./nav";
import { NAV_ICONS } from "./sidebar-nav";

const OPEN_EVENT = "open-command-palette";

/** A button (anywhere in the shell) that opens the palette. The palette itself lives once in the layout. */
export function PaletteTrigger({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("Shell.palette");
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      aria-label={t("open")}
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-background/40 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        compact ? "size-9 justify-center" : "h-9 min-w-[14rem] px-3",
        className,
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      {!compact && (
        <>
          <span className="flex-1 text-left">{t("placeholder")}</span>
          <kbd className="rounded-md border bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium">Ctrl K</kbd>
        </>
      )}
    </button>
  );
}

/** Ctrl/Cmd+K (or "/" outside a text field) opens a search over every page the member may see; Enter goes there. */
export function CommandPalette({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("Shell.palette");
  const tn = useTranslations("Shell.nav");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const show = () => {
      setQuery("");
      setCursor(0);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const entries = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.map((item) => ({ href: item.href, label: tn(`items.${item.label}`), group: g.label ? tn(`groups.${g.label}`) : "", key: item.label })),
      ),
    [groups, tn],
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q));
  }, [entries, query]);

  const index = Math.min(cursor, Math.max(0, results.length - 1));

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(results.length - 1, index + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(0, index - 1));
    } else if (e.key === "Enter") {
      const target = results[index];
      if (target) {
        e.preventDefault();
        go(target.href);
      }
    }
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>("[data-active=true]")?.scrollIntoView({ block: "nearest" });
  }, [index, results]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="top-[18%] max-w-[calc(100%-2rem)] -translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("description")}</DialogDescription>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={results[index] ? `palette-${results[index].key}` : undefined}
            placeholder={t("placeholder")}
            autoComplete="off"
            className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[50dvh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</li>}
          {results.map((entry, i) => {
            const Icon = NAV_ICONS[entry.key];
            const active = i === index;
            return (
              <li key={entry.href} id={`palette-${entry.key}`} role="option" aria-selected={active} data-active={active}>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => go(entry.href)}
                  onMouseMove={() => setCursor(i)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors", active ? "bg-primary/15 text-foreground" : "text-muted-foreground")}
                >
                  <Icon className={cn("size-4 shrink-0", active && "text-brand-text")} aria-hidden />
                  <span className="flex-1 font-medium">{entry.label}</span>
                  {entry.group && <span className="text-xs text-muted-foreground">{entry.group}</span>}
                  {active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
