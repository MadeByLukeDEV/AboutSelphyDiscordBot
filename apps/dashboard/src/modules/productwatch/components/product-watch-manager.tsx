"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { MAX_PRODUCT_WATCHES, PRODUCT_WATCH_INTERVAL_MINUTES, productWatchInput } from "@aboutselphy/shared/productwatch";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { checkProductWatchesAction, removeProductWatchAction, saveProductWatchAction } from "../actions";
import type { ProductWatchRow } from "../schema";

type FormValues = { name: string; url: string; channelId: string; pingRoleId: string; enabled: boolean };

/** Watched shop products: add, edit, look now, remove. State flows in as props; changes call router.refresh(). */
export function ProductWatchManager({ watches, channels, roles }: { watches: ProductWatchRow[]; channels: GuildChannel[] | null; roles: GuildRole[] | null }) {
  const t = useTranslations("ProductWatch");
  const te = useTranslations("ProductWatch.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ row: ProductWatchRow | null } | null>(null);

  const channelName = (id: string) => (channels?.find((c) => c.id === id) ? `#${channels.find((c) => c.id === id)!.name}` : id);
  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : t("never"));

  function remove(row: ProductWatchRow) {
    startTransition(async () => {
      const result = await removeProductWatchAction(row.id);
      if (result.ok) {
        toast.success(t("removed"));
        router.refresh();
      } else toast.error(te(result.error));
    });
  }

  function checkNow() {
    startTransition(async () => {
      const result = await checkProductWatchesAction();
      if (!result.ok) toast.error(te(result.error));
      else toast.success(result.botNotified ? t("checking") : t("checkLater"));
      // The bot looks in the background: show the result a moment later.
      setTimeout(() => router.refresh(), 4000);
    });
  }

  return (
    <section aria-labelledby="pw-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="pw-heading" className="text-fluid-lg font-bold">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("intro", { minutes: PRODUCT_WATCH_INTERVAL_MINUTES })}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={pending || watches.length === 0} onClick={checkNow}>
            <RefreshCw aria-hidden className="size-4" />
            {t("checkNow")}
          </Button>
          <Button type="button" disabled={watches.length >= MAX_PRODUCT_WATCHES} onClick={() => setEditing({ row: null })}>
            <Plus aria-hidden className="size-4" />
            {t("add")}
          </Button>
        </div>
      </div>

      {watches.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-8 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {watches.map((w) => (
            <li key={w.id} className="surface flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-medium">{w.name}</p>
                <Badge variant={w.enabled ? "default" : "secondary"}>{w.enabled ? t("on") : t("paused")}</Badge>
                {w.lastStatus && w.lastStatus !== "ok" && <Badge variant="destructive">{w.lastStatus}</Badge>}
              </div>
              <a href={w.url} target="_blank" rel="noreferrer noopener" className="truncate text-xs text-muted-foreground underline-offset-2 hover:underline">
                {w.url}
              </a>
              {w.baselined ? (
                <p className="text-sm tabular-nums">
                  {w.seenPrices.length > 0 && <span>{t("price", { price: w.seenPrices.join(" / ") })}</span>}
                  {w.seenAvailable !== null && <span> · {w.seenAvailable ? t("available") : t("soldOut")}</span>}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{t("notLookedYet")}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("meta", { channel: channelName(w.channelId), checked: when(w.lastCheckedAt), changed: when(w.lastChangedAt) })}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setEditing({ row: w })}>
                  {t("edit")}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => window.confirm(t("removeConfirm")) && remove(w)}>
                  {t("remove")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.row ? t("dialog.editTitle") : t("dialog.newTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <WatchForm
              key={editing.row?.id ?? "new"}
              row={editing.row}
              channels={channels}
              roles={roles}
              onSaved={() => {
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

function WatchForm({ row, channels, roles, onSaved }: { row: ProductWatchRow | null; channels: GuildChannel[] | null; roles: GuildRole[] | null; onSaved: () => void }) {
  const t = useTranslations("ProductWatch");
  const te = useTranslations("ProductWatch.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(productWatchInput.omit({ id: true })),
    defaultValues: { name: row?.name ?? "", url: row?.url ?? "", channelId: row?.channelId ?? "", pingRoleId: row?.pingRoleId ?? "", enabled: row?.enabled ?? true },
  });
  const { errors } = form.formState;

  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));
  if (row && !channelOptions.some((o) => o.value === row.channelId)) channelOptions.push({ value: row.channelId, label: row.channelId });
  const roleOptions: SelectOption[] = [{ value: "", label: t("noRole") }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];
  if (row?.pingRoleId && !roleOptions.some((o) => o.value === row.pingRoleId)) roleOptions.push({ value: row.pingRoleId, label: row.pingRoleId });

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveProductWatchAction({ ...values, ...(row ? { id: row.id } : {}) });
      if (result.ok) {
        toast.success(result.botNotified ? t("saved") : t("savedBotLater"));
        onSaved();
      } else toast.error(te(result.error));
    }),
  );

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="pw-name">{t("form.name")}</FieldLabel>
          <Input id="pw-name" maxLength={100} aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          {errors.name && <FieldError>{te("invalid")}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.url) || undefined}>
          <FieldLabel htmlFor="pw-url">{t("form.url")}</FieldLabel>
          <Input id="pw-url" maxLength={600} placeholder="https://shop.example/products/…" aria-invalid={Boolean(errors.url) || undefined} {...form.register("url")} />
          <FieldDescription>{t("form.urlHelp")}</FieldDescription>
          {errors.url && <FieldError>{te("badUrl")}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="pw-channel">{t("form.channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="pw-channel" options={channelOptions} placeholder={t("form.channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
          {errors.channelId && <FieldError>{te("needsChannel")}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="pw-role">{t("form.role")}</FieldLabel>
          <FormSelect control={form.control} name="pingRoleId" id="pw-role" options={roleOptions} placeholder={t("noRole")} disabled={roles === null} />
          <FieldDescription>{t("form.roleHelp")}</FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="pw-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="pw-enabled">{t("form.enabled")}</FieldLabel>
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
