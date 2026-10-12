"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { RAID_ACTIONS, raidSettingsSchema, type RaidSettings } from "@aboutselphy/shared/entry";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveRaidAction } from "../actions";
import type { RaidState } from "../schema";

/** The raid protection settings and whether a raid is on now. Alerts go to the moderation log channel (set on Settings). */
export function RaidManager({ initial, state }: { initial: RaidSettings; state: RaidState }) {
  const t = useTranslations("Raid");
  const te = useTranslations("Raid.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<RaidSettings>({ defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const [enabled, action] = useWatch({ control: form.control, name: ["enabled", "action"] });

  const actionOptions: SelectOption[] = RAID_ACTIONS.map((a) => ({ value: a, label: t(`actions.${a}`) }));
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  const save = form.handleSubmit((raw) => {
    const checked = raidSettingsSchema.safeParse({ ...raw, joinThreshold: Number(raw.joinThreshold), windowSeconds: Number(raw.windowSeconds), actionMinutes: Number(raw.actionMinutes), raidMinutes: Number(raw.raidMinutes) });
    if (!checked.success) return void toast.error(te("invalid"));
    startTransition(async () => {
      const result = await saveRaidAction(checked.data);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  return (
    <div className="flex flex-col gap-fluid">
      <section className="surface flex flex-col gap-1 p-5" aria-labelledby="rd-state">
        <h2 id="rd-state" className="text-fluid-lg font-bold">
          {t("state.title")}
        </h2>
        <p className="text-sm">{state.activeUntil ? t("state.on", { time: when(state.activeUntil) }) : t("state.off")}</p>
        {state.lastRaidAt && <p className="text-sm text-muted-foreground">{t("state.last", { time: when(state.lastRaidAt) })}</p>}
      </section>

      <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-5 p-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
        </div>
        <FieldGroup>
          <Field orientation="horizontal">
            <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="rd-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldLabel htmlFor="rd-enabled">{t("form.enabled")}</FieldLabel>
          </Field>
          <div className="flex flex-wrap gap-4">
            <Field data-invalid={Boolean(errors.joinThreshold) || undefined}>
              <FieldLabel htmlFor="rd-threshold">{t("form.threshold")}</FieldLabel>
              <Input id="rd-threshold" type="number" inputMode="numeric" min={3} max={100} className="max-w-[8rem]" {...form.register("joinThreshold", { valueAsNumber: true })} />
            </Field>
            <Field data-invalid={Boolean(errors.windowSeconds) || undefined}>
              <FieldLabel htmlFor="rd-window">{t("form.window")}</FieldLabel>
              <Input id="rd-window" type="number" inputMode="numeric" min={5} max={300} className="max-w-[8rem]" {...form.register("windowSeconds", { valueAsNumber: true })} />
            </Field>
          </div>
          <FieldDescription>{t("form.thresholdHelp")}</FieldDescription>
          <Field>
            <FieldLabel htmlFor="rd-action">{t("form.action")}</FieldLabel>
            <FormSelect control={form.control} name="action" id="rd-action" options={actionOptions} placeholder={t("form.action")} />
            <FieldDescription>{t("form.actionHelp")}</FieldDescription>
          </Field>
          {action === "timeout" && (
            <Field>
              <FieldLabel htmlFor="rd-minutes">{t("form.actionMinutes")}</FieldLabel>
              <Input id="rd-minutes" type="number" inputMode="numeric" min={1} max={1440} className="max-w-[8rem]" {...form.register("actionMinutes", { valueAsNumber: true })} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="rd-duration">{t("form.raidMinutes")}</FieldLabel>
            <Input id="rd-duration" type="number" inputMode="numeric" min={1} max={180} className="max-w-[8rem]" {...form.register("raidMinutes", { valueAsNumber: true })} />
            <FieldDescription>{t("form.raidMinutesHelp")}</FieldDescription>
          </Field>
        </FieldGroup>
        {enabled && action !== "alert" && (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            {t("form.warning")}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
