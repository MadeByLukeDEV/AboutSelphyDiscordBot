"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { GuildRole } from "@aboutselphy/shared";
import { Input } from "@/components/ui/input";

/**
 * Picks up to `max` roles. Selected ones are chips you can remove; below them a searchable list
 * of the roles the bot may hand out. A selected role that is gone (or no longer allowed) still
 * shows, by its id, so it can be removed.
 */
export function RolePicker({
  id,
  value,
  onChange,
  roles,
  max,
  disabled,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** null = the bot couldn't be reached, so the list isn't available. */
  roles: GuildRole[] | null;
  max: number;
  disabled?: boolean;
}) {
  const t = useTranslations("Welcome.roles");
  const [query, setQuery] = useState("");
  const nameOf = (roleId: string) => roles?.find((r) => r.id === roleId)?.name ?? roleId;
  const needle = query.trim().toLowerCase();
  const available = (roles ?? []).filter((r) => r.assignable && !value.includes(r.id) && (needle === "" || r.name.toLowerCase().includes(needle)));
  const full = value.length >= max;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex min-h-9 flex-wrap items-center gap-1.5" aria-label={t("selected")}>
        {value.length === 0 && <li className="text-sm text-muted-foreground">{t("none")}</li>}
        {value.map((roleId) => (
          <li key={roleId} className="flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
            <span className="max-w-[12rem] truncate">{nameOf(roleId)}</span>
            <button
              type="button"
              aria-label={t("remove", { name: nameOf(roleId) })}
              disabled={disabled}
              className="flex size-6 items-center justify-center rounded-full hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => onChange(value.filter((x) => x !== roleId))}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {roles === null ? (
        <p className="text-sm text-muted-foreground">{t("botOffline")}</p>
      ) : full ? (
        <p className="text-sm text-muted-foreground">{t("full", { max })}</p>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-xl border p-2">
          <Input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} autoComplete="off" disabled={disabled} />
          <ul className="flex max-h-44 flex-col overflow-y-auto" aria-label={t("available")}>
            {available.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">{t("noMatch")}</li>}
            {available.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={disabled}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => {
                    onChange([...value, r.id]);
                    setQuery("");
                  }}
                >
                  <span aria-hidden className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "transparent" }} />
                  <span className="truncate">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
