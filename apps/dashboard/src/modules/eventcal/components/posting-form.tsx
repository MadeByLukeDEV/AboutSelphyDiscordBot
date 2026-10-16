"use client";

import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { autoRuleName, EVENT_KINDS } from "@aboutselphy/shared/eventcal";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { savePostingAction } from "../actions";
import type { EventRuleRow, SourceRow } from "../schema";

type Row = { kind: (typeof EVENT_KINDS)[number]; channelId: string; pingRoleId: string; useCard: boolean };
type Values = { rows: Row[] };

/** The simple way to announce a game's events: per kind a channel, an optional role and a picture switch. Behind it the dashboard keeps one rule per kind. */
export function PostingForm({ source, rules, channelOptions, roleOptions, onDone }: { source: SourceRow; rules: EventRuleRow[]; channelOptions: SelectOption[]; roleOptions: SelectOption[]; onDone: () => void }) {
  const t = useTranslations("Events.games");
  const te = useTranslations("Events.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    defaultValues: {
      rows: EVENT_KINDS.map((kind) => {
        const rule = rules.find((r) => r.sourceId === source.id && r.name === autoRuleName(kind));
        return { kind, channelId: rule?.channelId ?? "", pingRoleId: rule?.pingRoleId ?? "", useCard: rule?.useCard ?? false };
      }),
    },
  });
  const watched = useWatch({ control: form.control, name: "rows" });
  const channels: SelectOption[] = [{ value: "", label: t("postingNone") }, ...channelOptions];
  const roles: SelectOption[] = [{ value: "", label: t("none") }, ...roleOptions];

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await savePostingAction({ sourceId: source.id, rows: values.rows });
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("postingSaved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
      <ul className="flex flex-col gap-3">
        {EVENT_KINDS.map((kind, i) => (
          <li key={kind} className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t(`kind.${kind}` as never)}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field className="min-w-0">
                <FieldLabel htmlFor={`po-${kind}-ch`}>{t("postingChannel")}</FieldLabel>
                <FormSelect control={form.control} name={`rows.${i}.channelId`} id={`po-${kind}-ch`} options={channels} placeholder={t("postingNone")} />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor={`po-${kind}-role`}>{t("patchRole")}</FieldLabel>
                <FormSelect control={form.control} name={`rows.${i}.pingRoleId`} id={`po-${kind}-role`} options={roles} placeholder={t("none")} />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Controller control={form.control} name={`rows.${i}.useCard`} render={({ field }) => <Switch id={`po-${kind}-card`} checked={field.value} onCheckedChange={field.onChange} disabled={!watched?.[i]?.channelId} />} />
              <FieldLabel htmlFor={`po-${kind}-card`}>{t("postingCard")}</FieldLabel>
            </Field>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("postingHelp")}</p>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
