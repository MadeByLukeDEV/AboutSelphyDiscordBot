"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteRolesAction } from "../actions";
import type { RoleRow } from "../schema";

type Filter = "all" | "empty" | "unused" | "deletable" | "protected";
const FILTERS: Filter[] = ["all", "empty", "unused", "deletable", "protected"];
const MAX_PER_REQUEST = 50;
const CONFIRM_WORD = "DELETE";

const hex = (color: number) => (color === 0 ? null : `#${color.toString(16).padStart(6, "0")}`);

/** All roles with search and filters, multi-select and a typed confirmation before deleting. State flows in as props; deleting calls router.refresh(). */
export function RoleManager({ roles }: { roles: RoleRow[] | null }) {
  const t = useTranslations("RoleManager");
  const te = useTranslations("RoleManager.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const all = useMemo(() => roles ?? [], [roles]);
  const byId = useMemo(() => new Map(all.map((r) => [r.id, r])), [all]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (filter === "empty") return r.memberCount === 0;
      if (filter === "unused") return r.usedBy.length === 0;
      if (filter === "deletable") return r.protectedReason === null;
      if (filter === "protected") return r.protectedReason !== null;
      return true;
    });
  }, [all, query, filter]);

  const deletableShown = shown.filter((r) => r.protectedReason === null);
  // Only roles that still exist and may be deleted stay selected (the list changes after a delete).
  const chosen = [...selected].map((id) => byId.get(id)).filter((r): r is RoleRow => Boolean(r) && r!.protectedReason === null);
  const chosenInUse = chosen.filter((r) => r.usedBy.length > 0);
  const chosenMembers = chosen.reduce((sum, r) => sum + r.memberCount, 0);
  const allShownSelected = deletableShown.length > 0 && deletableShown.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) for (const r of deletableShown) next.delete(r.id);
      else for (const r of deletableShown) next.add(r.id);
      return next;
    });
  }

  function confirmDelete() {
    const ids = chosen.map((r) => r.id);
    startTransition(async () => {
      let deleted = 0;
      let skipped = 0;
      // The server takes up to 50 per request.
      for (let i = 0; i < ids.length; i += MAX_PER_REQUEST) {
        const result = await deleteRolesAction(ids.slice(i, i + MAX_PER_REQUEST));
        if (!result.ok) {
          toast.error(te(result.error));
          break;
        }
        deleted += result.deleted.length;
        skipped += result.skipped.length;
      }
      if (deleted > 0) toast.success(t("deleted", { count: deleted }));
      if (skipped > 0) toast.error(t("skipped", { count: skipped }));
      setSelected(new Set());
      setConfirming(false);
      setTyped("");
      router.refresh();
    });
  }

  if (roles === null) {
    return <p className="surface p-5 text-sm text-muted-foreground">{t("botOffline")}</p>;
  }

  return (
    <section aria-labelledby="rmgr-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rmgr-heading" className="text-fluid-lg font-bold">
          {t("list.title")} <span className="text-sm font-normal text-muted-foreground">{t("list.count", { shown: shown.length, total: all.length })}</span>
        </h2>
        <Button variant="destructive" size="sm" disabled={chosen.length === 0 || pending} onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden />
          {t("deleteSelected", { count: chosen.length })}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="max-w-xs" maxLength={100} />
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("filters.label")}>
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-sm", filter === f ? "bg-primary/15" : "hover:bg-accent")}>
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 px-1 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={allShownSelected} disabled={deletableShown.length === 0} onChange={toggleAllShown} />
            {t("selectAllShown", { count: deletableShown.length })}
          </label>
          <ul className="flex flex-col gap-2">
            {shown.map((r) => {
              const locked = r.protectedReason !== null;
              const color = hex(r.color);
              return (
                <li key={r.id} className={cn("surface flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3", locked && "opacity-70")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-primary)]"
                    checked={selected.has(r.id)}
                    disabled={locked}
                    onChange={() => toggle(r.id)}
                    aria-label={t("select", { name: r.name })}
                  />
                  <span className="size-3 shrink-0 rounded-full border" style={color ? { backgroundColor: color } : undefined} aria-hidden />
                  <span className="min-w-[10rem] flex-1 break-words font-semibold">{r.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{t("members", { count: r.memberCount })}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {r.powerful && <Badge variant="secondary">{t("badge.powerful")}</Badge>}
                    {r.usedBy.map((u) => (
                      <Badge key={u} variant="secondary">
                        {t(`usage.${u}`)}
                      </Badge>
                    ))}
                    {r.protectedReason && <Badge>{t(`protected.${r.protectedReason}`)}</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(false);
            setTyped("");
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("confirm.title", { count: chosen.length })}</DialogTitle>
            <DialogDescription>{t("confirm.body", { members: chosenMembers })}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 overflow-y-auto rounded-lg border p-2 text-sm">
            {chosen.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 py-0.5">
                <span className="min-w-0 break-words">{r.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{t("members", { count: r.memberCount })}</span>
              </li>
            ))}
          </ul>
          {chosenInUse.length > 0 && <p className="text-sm text-destructive">{t("confirm.inUse", { count: chosenInUse.length })}</p>}
          <Field>
            <FieldLabel htmlFor="rmgr-confirm">{t("confirm.type", { word: CONFIRM_WORD })}</FieldLabel>
            <Input id="rmgr-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" maxLength={20} />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("confirm.back")}</DialogClose>
            <Button variant="destructive" disabled={pending || typed !== CONFIRM_WORD || chosen.length === 0} onClick={confirmDelete}>
              {pending ? t("confirm.deleting") : t("confirm.button", { count: chosen.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
