"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { countingSettingsSchema, type CountingSettings } from "@aboutselphy/shared/counting";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { resetCountingAction, saveCountingAction } from "../actions";
import type { CountingStats } from "../schema";

/** The counting channel settings and its current numbers. State flows in as props; changes call router.refresh(). */
export function CountingManager({ initial, stats, channels }: { initial: CountingSettings; stats: CountingStats; channels: GuildChannel[] | null }) {
  const t = useTranslations("Counting");
  const te = useTranslations("Counting.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<CountingSettings>({ resolver: zodResolver(countingSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;

  const channelOptions: SelectOption[] = [
    { value: "", label: t("none") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (initial.channelId && !channelOptions.some((o) => o.value === initial.channelId)) channelOptions.push({ value: initial.channelId, label: initial.channelId });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveCountingAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  function reset() {
    startTransition(async () => {
      const result = await resetCountingAction();
      if (result.ok) {
        toast.success(t("resetDone"));
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-fluid">
      <section className="surface flex flex-col gap-2 p-5" aria-labelledby="ct-stats">
        <h2 id="ct-stats" className="text-fluid-lg font-bold">
          {t("stats.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("stats.current", { count: stats.currentCount })}</p>
        <p className="text-sm text-muted-foreground">{t("stats.high", { count: stats.highScore })}</p>
        <div>
          <Button variant="outline" size="sm" disabled={pending || stats.currentCount === 0} onClick={reset}>
            {t("reset")}
          </Button>
        </div>
      </section>

      <form onSubmit={onSubmit} className="surface flex flex-col gap-5 p-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
        </div>
        <FieldGroup>
          <Field orientation="horizontal">
            <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="ct-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldLabel htmlFor="ct-enabled">{t("form.enabled")}</FieldLabel>
          </Field>
          <Field data-invalid={Boolean(errors.channelId) || undefined}>
            <FieldLabel htmlFor="ct-channel">{t("form.channel")}</FieldLabel>
            <FormSelect control={form.control} name="channelId" id="ct-channel" options={channelOptions} placeholder={t("form.channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
            <FieldDescription>{channels === null ? t("form.botOffline") : t("form.channelHelp")}</FieldDescription>
            {errors.channelId && <FieldError>{te("needsChannel")}</FieldError>}
          </Field>
          <Field orientation="horizontal">
            <Controller control={form.control} name="resetOnMistake" render={({ field }) => <Switch id="ct-reset" checked={field.value} onCheckedChange={field.onChange} />} />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="ct-reset">{t("form.resetOnMistake")}</FieldLabel>
              <FieldDescription>{t("form.resetHelp")}</FieldDescription>
            </div>
          </Field>
          <Field orientation="horizontal">
            <Controller control={form.control} name="allowConsecutive" render={({ field }) => <Switch id="ct-consecutive" checked={field.value} onCheckedChange={field.onChange} />} />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="ct-consecutive">{t("form.allowConsecutive")}</FieldLabel>
              <FieldDescription>{t("form.consecutiveHelp")}</FieldDescription>
            </div>
          </Field>
        </FieldGroup>
        <div>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
