"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cleanupDanglingAction, mergeRolesAction, updateRoleAction } from "../actions";
import type { Dangling, RoleRow, UsageKey } from "../schema";

const toHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Rename and recolour one role. */
export function EditRoleDialog({ role, onClose }: { role: RoleRow | null; onClose: () => void }) {
  const t = useTranslations("RoleManager.edit");
  const te = useTranslations("RoleManager.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={role !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>
        {role && (
          <form
            key={role.id}
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const name = String(data.get("name") ?? "").trim();
              const none = data.get("none") === "on";
              const color = none ? 0 : parseInt(String(data.get("color") ?? "#000000").slice(1), 16);
              if (!name || name.length > 100 || Number.isNaN(color)) return void toast.error(te("invalid"));
              const patch = { id: role.id, ...(name !== role.name ? { name } : {}), ...(color !== role.color ? { color } : {}) };
              if (!("name" in patch) && !("color" in patch)) return void onClose();
              startTransition(async () => {
                const result = await updateRoleAction(patch);
                if (result.ok) {
                  toast.success(t("saved"));
                  onClose();
                  router.refresh();
                } else {
                  toast.error(te(result.error));
                }
              });
            }}
          >
            <Field>
              <FieldLabel htmlFor="re-name">{t("name")}</FieldLabel>
              <Input id="re-name" name="name" defaultValue={role.name} maxLength={100} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="re-color">{t("color")}</FieldLabel>
              <div className="flex flex-wrap items-center gap-3">
                <input id="re-color" name="color" type="color" defaultValue={role.color === 0 ? "#99aab5" : toHex(role.color)} className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="none" defaultChecked={role.color === 0} className="size-4 accent-[var(--color-primary)]" />
                  {t("noColor")}
                </label>
              </div>
            </Field>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Merge the selected roles into another one: everyone who has a source gets the target. */
export function MergeDialog({ open, sources, candidates, onClose, onDone }: { open: boolean; sources: RoleRow[]; candidates: RoleRow[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("RoleManager.merge");
  const te = useTranslations("RoleManager.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteSources, setDeleteSources] = useState(true);
  const form = useForm<{ targetId: string }>({ defaultValues: { targetId: "" } });
  const options: SelectOption[] = candidates.filter((r) => r.protectedReason === null && !r.powerful && !sources.some((s) => s.id === r.id)).map((r) => ({ value: r.id, label: r.name }));
  const members = sources.reduce((sum, r) => sum + r.memberCount, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title", { count: sources.length })}</DialogTitle>
          <DialogDescription>{t("intro", { members })}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-40 overflow-y-auto rounded-lg border p-2 text-sm">
          {sources.map((r) => (
            <li key={r.id} className="py-0.5">
              {r.name}
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => {
            if (!values.targetId) return void toast.error(te("pickTarget"));
            startTransition(async () => {
              const result = await mergeRolesAction({ sourceIds: sources.map((r) => r.id), targetId: values.targetId, deleteSources });
              if (result.ok) {
                toast.success(t("done", { added: result.added, deleted: result.deleted.length }));
                if (result.failed > 0) toast.error(t("someFailed", { count: result.failed }));
                onDone();
                router.refresh();
              } else {
                toast.error(te(result.error));
              }
            });
          })}
          noValidate
        >
          <Field>
            <FieldLabel htmlFor="rm-target">{t("target")}</FieldLabel>
            <FormSelect control={form.control} name="targetId" id="rm-target" options={options} placeholder={t("targetPlaceholder")} />
            <FieldDescription>{t("targetHelp")}</FieldDescription>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deleteSources} onChange={(e) => setDeleteSources(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            {t("deleteSources")}
          </label>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={pending || options.length === 0}>
              {pending ? t("merging") : t("button")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Settings that still point at roles which no longer exist. */
export function DanglingCard({ dangling }: { dangling: Dangling }) {
  const t = useTranslations("RoleManager.dangling");
  const tu = useTranslations("RoleManager.usage");
  const te = useTranslations("RoleManager.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (dangling.length === 0) return null;
  return (
    <section aria-labelledby="rmgr-dangling" className="surface flex flex-col gap-3 border-destructive/40 p-5">
      <h2 id="rmgr-dangling" className="text-fluid-lg font-bold">
        {t("title")}
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      <ul className="flex flex-wrap gap-2 text-sm">
        {dangling.map((d) => (
          <li key={d.key} className="rounded-full border px-3 py-1">
            {tu(d.key as UsageKey)} <span className="tabular-nums text-muted-foreground">×{d.count}</span>
          </li>
        ))}
      </ul>
      <div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cleanupDanglingAction();
              if (result.ok) {
                toast.success(t("done", { count: Object.values(result.removed).reduce((a, b) => a + (b ?? 0), 0) }));
                router.refresh();
              } else {
                toast.error(te(result.error));
              }
            })
          }
        >
          {pending ? t("cleaning") : t("button")}
        </Button>
      </div>
    </section>
  );
}
