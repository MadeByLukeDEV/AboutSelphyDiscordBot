"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { autoResponderInput, MATCH_TYPES, MAX_RESPONDER_CHANNELS, MAX_RESPONSE, MAX_TRIGGER, type MatchType } from "@aboutselphy/shared/auto-responders";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { MultiPicker } from "@/components/form/multi-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { removeAutoResponderAction, saveAutoResponderAction } from "../actions";
import type { AutoResponderRow } from "../schema";

type FormValues = { trigger: string; matchType: MatchType; response: string; cooldownSeconds: number; channelIds: string[]; enabled: boolean };

/** The auto-responders with add, edit and remove. State flows in as props; changes call router.refresh(). */
export function AutoRespondersManager({ responders, channels, max }: { responders: AutoResponderRow[]; channels: GuildChannel[] | null; max: number }) {
  const t = useTranslations("AutoResponders");
  const te = useTranslations("AutoResponders.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ row: AutoResponderRow | null } | null>(null);

  function remove(row: AutoResponderRow) {
    startTransition(async () => {
      const result = await removeAutoResponderAction(row.id);
      if (result.ok) {
        toast.success(t("removed"));
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <section aria-labelledby="ar-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ar-heading" className="text-fluid-lg font-bold">
          {t("list.title")} <span className="text-sm font-normal text-muted-foreground">{t("list.count", { count: responders.length, max })}</span>
        </h2>
        <Button size="sm" disabled={responders.length >= max} onClick={() => setEditing({ row: null })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {responders.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {responders.map((r) => (
            <li key={r.id} className="surface flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold break-words">“{r.trigger}”</span>
                  <Badge variant="secondary">{t(`match.${r.matchType}`)}</Badge>
                  <Badge variant={r.enabled ? "default" : "secondary"}>{r.enabled ? t("on") : t("off")}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{r.response}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("list.meta", { uses: r.uses, seconds: r.cooldownSeconds })} · {r.channelIds.length === 0 ? t("list.everywhere") : t("list.inChannels", { count: r.channelIds.length })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ row: r })}>
                  {t("edit")}
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(r)}>
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
            <ResponderForm
              key={editing.row?.id ?? "new"}
              row={editing.row}
              channels={channels}
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

function ResponderForm({ row, channels, onDone }: { row: AutoResponderRow | null; channels: GuildChannel[] | null; onDone: () => void }) {
  const t = useTranslations("AutoResponders.form");
  const tp = useTranslations("AutoResponders.picker");
  const tm = useTranslations("AutoResponders.match");
  const te = useTranslations("AutoResponders.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    defaultValues: row ? { trigger: row.trigger, matchType: row.matchType, response: row.response, cooldownSeconds: row.cooldownSeconds, channelIds: row.channelIds, enabled: row.enabled } : { trigger: "", matchType: "word", response: "", cooldownSeconds: 30, channelIds: [], enabled: true },
  });
  const { errors } = form.formState;

  const matchOptions: SelectOption[] = MATCH_TYPES.map((m) => ({ value: m, label: tm(m) }));
  const channelItems = channels === null ? null : channels.map((c) => ({ id: c.id, label: `#${c.name}` }));

  const submit = form.handleSubmit((values) => {
    const checked = autoResponderInput.safeParse({ ...(row ? { id: row.id } : {}), ...values });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "trigger" || key === "response" || key === "cooldownSeconds") form.setError(key, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveAutoResponderAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.trigger) || undefined}>
          <FieldLabel htmlFor="ar-trigger">{t("trigger")}</FieldLabel>
          <Input id="ar-trigger" maxLength={MAX_TRIGGER} aria-invalid={Boolean(errors.trigger) || undefined} {...form.register("trigger")} />
          <FieldDescription>{t("triggerHelp")}</FieldDescription>
          {errors.trigger && <FieldError>{te("needsTrigger")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="ar-match">{t("match")}</FieldLabel>
          <FormSelect control={form.control} name="matchType" id="ar-match" options={matchOptions} />
          <FieldDescription>{t("matchHelp")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.response) || undefined}>
          <FieldLabel htmlFor="ar-response">{t("response")}</FieldLabel>
          <Textarea id="ar-response" rows={5} maxLength={MAX_RESPONSE} aria-invalid={Boolean(errors.response) || undefined} {...form.register("response")} />
          <FieldDescription>{t("responseHelp")}</FieldDescription>
          {errors.response && <FieldError>{te("needsResponse")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.cooldownSeconds) || undefined}>
          <FieldLabel htmlFor="ar-cooldown">{t("cooldown")}</FieldLabel>
          <Input id="ar-cooldown" type="number" inputMode="numeric" min={0} max={86400} className="max-w-[8rem]" {...form.register("cooldownSeconds", { valueAsNumber: true })} />
          <FieldDescription>{t("cooldownHelp")}</FieldDescription>
          {errors.cooldownSeconds && <FieldError>{te("badCooldown")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="ar-channels">{t("channels")}</FieldLabel>
          <Controller
            control={form.control}
            name="channelIds"
            render={({ field }) => (
              <MultiPicker
                id="ar-channels"
                value={field.value}
                onChange={field.onChange}
                items={channelItems}
                max={MAX_RESPONDER_CHANNELS}
                labels={{ selected: tp("selected"), none: tp("none"), search: tp("search"), noMatch: tp("noMatch"), full: tp("full", { max: MAX_RESPONDER_CHANNELS }), offline: tp("offline"), remove: (name: string) => tp("remove", { name }) }}
              />
            )}
          />
          <FieldDescription>{t("channelsHelp")}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="ar-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="ar-enabled">{t("enabled")}</FieldLabel>
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
