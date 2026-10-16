"use client";

import { cn } from "@/lib/utils";

export type FilterOption = { id: string; label: string; count: number };

/** A row of small toggle buttons with counts, to narrow a long list ("All 24 · Active 3 · Ended 21"). One is always chosen. */
export function FilterChips({ label, options, value, onChange }: { label: string; options: FilterOption[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              on ? "border-primary/50 bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {o.label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}
