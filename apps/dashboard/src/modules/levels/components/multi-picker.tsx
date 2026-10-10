"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

export type PickItem = { id: string; label: string };

/**
 * Picks several channels or roles. Selected ones are chips you can remove; below them a searchable
 * list of what can still be added. A selected item that no longer exists still shows, by its id, so
 * it can be removed.
 */
export function MultiPicker({
  id,
  value,
  onChange,
  items,
  max,
  labels,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** null = the bot couldn't be reached, so the list isn't available. */
  items: PickItem[] | null;
  max: number;
  labels: { selected: string; none: string; search: string; noMatch: string; full: string; offline: string; remove: (name: string) => string };
}) {
  const [query, setQuery] = useState("");
  const nameOf = (itemId: string) => items?.find((i) => i.id === itemId)?.label ?? itemId;
  const needle = query.trim().toLowerCase();
  const available = (items ?? []).filter((i) => !value.includes(i.id) && (needle === "" || i.label.toLowerCase().includes(needle)));

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex min-h-9 flex-wrap items-center gap-1.5" aria-label={labels.selected}>
        {value.length === 0 && <li className="text-sm text-muted-foreground">{labels.none}</li>}
        {value.map((itemId) => (
          <li key={itemId} className="flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
            <span className="max-w-[12rem] truncate">{nameOf(itemId)}</span>
            <button
              type="button"
              aria-label={labels.remove(nameOf(itemId))}
              className="flex size-6 items-center justify-center rounded-full hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => onChange(value.filter((x) => x !== itemId))}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {items === null ? (
        <p className="text-sm text-muted-foreground">{labels.offline}</p>
      ) : value.length >= max ? (
        <p className="text-sm text-muted-foreground">{labels.full}</p>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-xl border p-2">
          <Input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={labels.search} aria-label={labels.search} autoComplete="off" />
          <ul className="flex max-h-40 flex-col overflow-y-auto">
            {available.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">{labels.noMatch}</li>}
            {available.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => {
                    onChange([...value, i.id]);
                    setQuery("");
                  }}
                >
                  <span className="truncate">{i.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
