"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { MAX_STICKY_CONTENT, stickyInput } from "@aboutselphy/shared/sticky";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { removeStickyAction, saveStickyAction } from "../actions";
import type { StickyRow } from "../schema";

type FormValues = { channelId: string; content: string; enabled: boolean };

/** The sticky messages with add, edit and remove. State flows in as props; changes call router.refresh(). */
export function StickyManager({ stickies, channels, max }: { stickies: StickyRow[]; channels: GuildChannel[] | null; max: number }) {
  const t = useTranslations("Sticky");
  const te = useTranslations("Sticky.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ row: StickyRow | null } | null>(null);

  const channelName = (id: string) => (channels?.find((c) => c.id === id) ? `#${channels.find((c) => c.id === id)!.name}` : id);

  function remove(row: StickyRow) {
    startTransition(async () => {
      const result = await removeStickyAction(row.id);
      if (result.ok) {
        toast.success(t("removed"));
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <section aria-labelledby="st-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="st-heading" className="text-fluid-lg font-bold">
          {t("list.title")} <span className="text-sm font-normal text-muted-foreground">{t("list.count", { count: stickies.length, max })}</span>
        </h2>
        <Button size="sm" disabled={stickies.length >= max || channels === null} onClick={() => setEditing({ row: null })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>
      {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}

      {stickies.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {stickies.map((s) => (
            <li key={s.id} className="surface flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{channelName(s.channelId)}</span>
                  <Badge variant={s.enabled ? "default" : "secondary"}>{s.enabled ? t("on") : t("off")}</Badge>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{s.content}</p>
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
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.row ? t("dialog.editTitle") : t("dialog.newTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <StickyForm
              key={editing.row?.id ?? "new"}
              row={editing.row}
              channels={channels}
              taken={new Set(stickies.map((s) => s.channelId))}
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

function StickyForm({ row, channels, taken, onDone }: { row: StickyRow | null; channels: GuildChannel[] | null; taken: Set<string>; onDone: () => void }) {
  const t = useTranslations("Sticky.form");
  const te = useTranslations("Sticky.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: row ? { channelId: row.channelId, content: row.content, enabled: row.enabled } : { channelId: "", content: "", enabled: true } });
  const { errors } = form.formState;

  const channelOptions: SelectOption[] = (channels ?? []).filter((c) => row !== null || !taken.has(c.id)).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));
  if (row && !channelOptions.some((o) => o.value === row.channelId)) channelOptions.push({ value: row.channelId, label: row.channelId });

  const submit = form.handleSubmit((values) => {
    const checked = stickyInput.safeParse({ ...(row ? { id: row.id } : {}), ...values });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "channelId" || key === "content") form.setError(key, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveStickyAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="st-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="st-channel" options={channelOptions} placeholder={t("channelPlaceholder")} disabled={channels === null || row !== null} invalid={Boolean(errors.channelId)} />
          <FieldDescription>{t("channelHelp")}</FieldDescription>
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.content) || undefined}>
          <FieldLabel htmlFor="st-content">{t("content")}</FieldLabel>
          <Textarea id="st-content" rows={6} maxLength={MAX_STICKY_CONTENT} aria-invalid={Boolean(errors.content) || undefined} {...form.register("content")} />
          <FieldDescription>{t("contentHelp")}</FieldDescription>
          {errors.content && <FieldError>{te("needsContent")}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="st-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="st-enabled">{t("enabled")}</FieldLabel>
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
