"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type PageTab = { id: string; label: string; /** A small number next to the label (for example how many items). */ count?: number; content: React.ReactNode };

/**
 * Splits a long page into tabs so only one part is on screen at a time. Every panel stays mounted (hidden), so a half-filled form
 * keeps its input when you switch away. The chosen tab is kept in the address (`?tab=`), so a reload or a shared link opens the same one.
 * `initial` comes from the page's search params (the server already knows it, so nothing flashes).
 */
export function PageTabs({ tabs, initial }: { tabs: PageTab[]; initial?: string }) {
  const base = useId();
  const [active, setActive] = useState(() => (tabs.some((t) => t.id === initial) ? (initial as string) : (tabs[0]?.id ?? "")));
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function choose(id: string) {
    setActive(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // The address is only a convenience.
    }
  }

  function onKey(e: React.KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    const target = tabs[next];
    if (!target) return;
    choose(target.id);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-fluid">
      <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b px-1" aria-orientation="horizontal">
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(tab.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected ? "text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">{tab.count}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${base}-panel-${tab.id}`} aria-labelledby={`${base}-tab-${tab.id}`} hidden={tab.id !== active} className="flex flex-col gap-fluid focus-visible:outline-none">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
