"use client";

import { SaveRow } from "@/components/page/save-row";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { LOG_CATEGORIES, logSettingsSchema, type LogSettings } from "@aboutselphy/shared/logs";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { saveLogSettingsAction } from "../actions";

/** One card per kind of log: a switch and a channel. Several kinds can share one channel. */
export function LogsForm({ initial, channels }: { initial: LogSettings; channels: GuildChannel[] | null }) {
  const t = useTranslations("Logs");
  const te = useTranslations("Logs.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<LogSettings>({ resolver: zodResolver(logSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;

  const options: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  for (const c of LOG_CATEGORIES) {
    const saved = initial[c].channelId;
    if (saved && !options.some((o) => o.value === saved)) options.push({ value: saved, label: saved });
  }

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveLogSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("saved") : t("savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-fluid" noValidate>
      {LOG_CATEGORIES.map((category) => (
        <section key={category} aria-labelledby={`log-${category}`} className="surface flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 id={`log-${category}`} className="text-fluid-lg font-bold">
              {t(`categories.${category}.title`)}
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t(`categories.${category}.body`)}</p>
          </div>
          <Field orientation="horizontal">
            <Controller
              control={form.control}
              name={`${category}.enabled`}
              render={({ field }) => <Switch id={`log-${category}-on`} checked={field.value} onCheckedChange={field.onChange} />}
            />
            <FieldLabel htmlFor={`log-${category}-on`}>{t("enabled")}</FieldLabel>
          </Field>
          <Field data-invalid={Boolean(errors[category]?.channelId) || undefined}>
            <FieldLabel htmlFor={`log-${category}-channel`}>{t("channel")}</FieldLabel>
            <FormSelect
              control={form.control}
              name={`${category}.channelId`}
              id={`log-${category}-channel`}
              options={options}
              placeholder={t("channelPlaceholder")}
              disabled={channels === null}
              invalid={Boolean(errors[category]?.channelId)}
            />
            <FieldDescription>{channels === null ? t("botOffline") : t("channelHelp")}</FieldDescription>
            {errors[category]?.channelId && <FieldError>{te("needsChannel")}</FieldError>}
          </Field>
        </section>
      ))}
      <SaveRow dirty={isDirty} pending={pending} label={t("save")} savingLabel={t("saving")} />
    </form>
  );
}
