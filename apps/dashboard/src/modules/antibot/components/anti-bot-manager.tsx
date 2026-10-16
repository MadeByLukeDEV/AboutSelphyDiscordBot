"use client";

import { SaveRow } from "@/components/page/save-row";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { ANTIBOT_TIMEOUT_CHOICES, antiBotSettingsSchema, type AntiBotSettings } from "@aboutselphy/shared/antibot";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { saveAntiBotAction } from "../actions";
import type { AntiBotStats } from "../schema";

const TIMEOUT_KEY = { 3600: "hour", 86400: "day", 604800: "week", 2419200: "fourWeeks" } as const;

type FormValues = { enabled: boolean; channelId: string; timeout: string; dryRun: boolean };

const toForm = (s: AntiBotSettings): FormValues => ({ enabled: s.enabled, channelId: s.channelId, timeout: String(s.timeoutSeconds), dryRun: s.dryRun });

/** The anti-bot channel settings and how many members it has caught. State flows in as props; saving calls router.refresh(). */
export function AntiBotManager({ initial, stats, channels }: { initial: AntiBotSettings; stats: AntiBotStats; channels: GuildChannel[] | null }) {
  const t = useTranslations("AntiBot");
  const te = useTranslations("AntiBot.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({ defaultValues: toForm(initial) });
  const { errors, isDirty } = form.formState;
  const [enabled, dryRun] = useWatch({ control: form.control, name: ["enabled", "dryRun"] });

  const channelOptions: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (initial.channelId && !channelOptions.some((o) => o.value === initial.channelId)) channelOptions.push({ value: initial.channelId, label: initial.channelId });
  const timeoutOptions: SelectOption[] = ANTIBOT_TIMEOUT_CHOICES.map((s) => ({ value: String(s), label: t(`timeouts.${TIMEOUT_KEY[s]}`) }));
  if (!timeoutOptions.some((o) => o.value === String(initial.timeoutSeconds))) timeoutOptions.push({ value: String(initial.timeoutSeconds), label: t("timeouts.custom", { seconds: initial.timeoutSeconds }) });

  const submit = form.handleSubmit((values) => {
    const checked = antiBotSettingsSchema.safeParse({ enabled: values.enabled, channelId: values.channelId, timeoutSeconds: Number(values.timeout), dryRun: values.dryRun });
    if (!checked.success) {
      form.setError("channelId", { type: "custom", message: "channel" });
      return;
    }
    startTransition(async () => {
      const result = await saveAntiBotAction(checked.data);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(toForm(result.settings));
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  return (
    <div className="flex flex-col gap-fluid">
      <section className="surface flex flex-col gap-1 p-5" aria-labelledby="ab-stats">
        <h2 id="ab-stats" className="text-fluid-lg font-bold">
          {t("stats.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("stats.caught", { count: stats.hits })}</p>
        {stats.lastHitAt && <p className="text-sm text-muted-foreground">{t("stats.last", { time: format.dateTime(new Date(stats.lastHitAt), { dateStyle: "medium", timeStyle: "short" }) })}</p>}
      </section>

      <form onSubmit={(e) => void submit(e)} className="surface flex flex-col gap-5 p-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
        </div>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.channelId) || undefined}>
            <FieldLabel htmlFor="ab-channel">{t("form.channel")}</FieldLabel>
            <FormSelect control={form.control} name="channelId" id="ab-channel" options={channelOptions} placeholder={t("noChannel")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
            <FieldDescription>{channels === null ? t("form.botOffline") : t("form.channelHelp")}</FieldDescription>
            {errors.channelId && <FieldError>{te("needsChannel")}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="ab-timeout">{t("form.timeout")}</FieldLabel>
            <FormSelect control={form.control} name="timeout" id="ab-timeout" options={timeoutOptions} placeholder={t("form.timeout")} />
            <FieldDescription>{t("form.timeoutHelp")}</FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <Controller control={form.control} name="dryRun" render={({ field }) => <Switch id="ab-dry" checked={field.value} onCheckedChange={field.onChange} />} />
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor="ab-dry">{t("form.dryRun")}</FieldLabel>
              <FieldDescription>{t("form.dryRunHelp")}</FieldDescription>
            </div>
          </Field>
          <Field orientation="horizontal">
            <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="ab-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldLabel htmlFor="ab-enabled">{t("form.enabled")}</FieldLabel>
          </Field>
        </FieldGroup>
        {enabled && !dryRun && (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            {t("form.live")}
          </p>
        )}
        <SaveRow dirty={isDirty} pending={pending} label={t("form.save")} savingLabel={t("form.saving")} />
      </form>

      <section className="surface flex flex-col gap-2 p-5" aria-labelledby="ab-how">
        <h2 id="ab-how" className="text-fluid-lg font-bold">
          {t("how.title")}
        </h2>
        <ul className="flex max-w-prose list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
          {(["delete", "timeout", "kick", "spared", "setup"] as const).map((k) => (
            <li key={k}>{t(`how.${k}`)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
