"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { DEFAULT_STAT_TEMPLATE, MAX_STAT_TEMPLATE, STAT_KINDS, statChannelInput, type StatKind } from "@aboutselphy/shared/stat-channels";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { removeStatChannelAction, saveStatChannelAction } from "../actions";
import type { StatChannelRow } from "../schema";

type FormValues = { channelId: string; kind: StatKind; template: string };

/** The stat channels with add, edit and remove. State flows in as props; changes call router.refresh(). */
export function StatChannelsManager({ stats, channels, max }: { stats: StatChannelRow[]; channels: GuildChannel[] | null; max: number }) {
  const t = useTranslations("StatChannels");
  const te = useTranslations("StatChannels.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ row: StatChannelRow | null } | null>(null);

  const channelName = (id: string) => (channels?.find((c) => c.id === id) ? channels.find((c) => c.id === id)!.name : id);

  function remove(row: StatChannelRow) {
    startTransition(async () => {
      const result = await removeStatChannelAction(row.id);
      if (result.ok) {
        toast.success(t("removed"));
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <section aria-labelledby="sc-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sc-heading" className="text-fluid-lg font-bold">
          {t("list.title")} <span className="text-sm font-normal text-muted-foreground">{t("list.count", { count: stats.length, max })}</span>
        </h2>
        <Button size="sm" disabled={stats.length >= max || channels === null} onClick={() => setEditing({ row: null })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>
      {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}

      {stats.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {stats.map((s) => (
            <li key={s.id} className="surface flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[12rem] flex-1">
                <p className="font-semibold">{s.lastName ?? s.template}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`kinds.${s.kind}`)} · {channelName(s.channelId)}
                  {s.lastName === null ? ` · ${t("list.notYet")}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ row: s })}>
                  {t("edit")}
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(s)}>
                  {t("remove")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.row ? t("dialog.editTitle") : t("dialog.newTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <StatForm
              key={editing.row?.id ?? "new"}
              row={editing.row}
              channels={channels}
              taken={new Set(stats.map((s) => s.channelId))}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatForm({ row, channels, taken, onDone }: { row: StatChannelRow | null; channels: GuildChannel[] | null; taken: Set<string>; onDone: () => void }) {
  const t = useTranslations("StatChannels.form");
  const tk = useTranslations("StatChannels.kinds");
  const te = useTranslations("StatChannels.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: row ? { channelId: row.channelId, kind: row.kind, template: row.template } : { channelId: "", kind: "members", template: DEFAULT_STAT_TEMPLATE } });
  const { errors } = form.formState;

  const channelOptions: SelectOption[] = (channels ?? []).filter((c) => row !== null || !taken.has(c.id)).map((c) => ({ value: c.id, label: c.parent ? `${c.name} (${c.parent})` : c.name, text: c.name, group: c.parent ?? undefined }));
  if (row && !channelOptions.some((o) => o.value === row.channelId)) channelOptions.push({ value: row.channelId, label: row.channelId });
  const kindOptions: SelectOption[] = STAT_KINDS.map((k) => ({ value: k, label: tk(k) }));

  const submit = form.handleSubmit((values) => {
    const checked = statChannelInput.safeParse({ ...(row ? { id: row.id } : {}), ...values });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "channelId" || key === "kind" || key === "template") form.setError(key, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveStatChannelAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="sc-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="sc-channel" options={channelOptions} placeholder={t("channelPlaceholder")} disabled={channels === null || row !== null} invalid={Boolean(errors.channelId)} />
          <FieldDescription>{t("channelHelp")}</FieldDescription>
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="sc-kind">{t("kind")}</FieldLabel>
          <FormSelect control={form.control} name="kind" id="sc-kind" options={kindOptions} />
        </Field>
        <Field data-invalid={Boolean(errors.template) || undefined}>
          <FieldLabel htmlFor="sc-template">{t("template")}</FieldLabel>
          <Input id="sc-template" maxLength={MAX_STAT_TEMPLATE} aria-invalid={Boolean(errors.template) || undefined} {...form.register("template")} />
          <FieldDescription>{t("templateHelp")}</FieldDescription>
          {errors.template && <FieldError>{te("needsCount")}</FieldError>}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
