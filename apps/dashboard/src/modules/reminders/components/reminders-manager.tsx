"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { MAX_PER_USER, MIN_PER_USER, reminderSettingsSchema, type ReminderSettings } from "@aboutselphy/shared/reminders";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MemberCardSettings } from "@/modules/member-cards/components/member-card-settings";
import type { CardImageView } from "@/modules/member-cards/schema";
import { saveReminderSettingsAction } from "../actions";
import type { ReminderStats } from "../schema";

/** The reminder settings and a count of pending reminders (their text stays private). */
export function RemindersManager({ initial, stats, cardImage }: { initial: ReminderSettings; stats: ReminderStats; cardImage: CardImageView | null }) {
  const t = useTranslations("Reminders");
  const te = useTranslations("Reminders.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ReminderSettings>({ resolver: zodResolver(reminderSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveReminderSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  return (
    <div className="flex flex-col gap-fluid">
      <section className="surface flex flex-col gap-1 p-5" aria-labelledby="rm-stats">
        <h2 id="rm-stats" className="text-fluid-lg font-bold">
          {t("stats.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("stats.pending", { count: stats.pending })}</p>
        {stats.nextAt && <p className="text-sm text-muted-foreground">{t("stats.next", { time: format.dateTime(new Date(stats.nextAt), { dateStyle: "medium", timeStyle: "short" }) })}</p>}
      </section>

      <form onSubmit={onSubmit} className="surface flex flex-col gap-5 p-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
        </div>
        <FieldGroup>
          <Field orientation="horizontal">
            <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="rm-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldLabel htmlFor="rm-enabled">{t("form.enabled")}</FieldLabel>
          </Field>
          <Field data-invalid={Boolean(errors.maxPerUser) || undefined}>
            <FieldLabel htmlFor="rm-max">{t("form.max")}</FieldLabel>
            <Input id="rm-max" type="number" inputMode="numeric" min={MIN_PER_USER} max={MAX_PER_USER} className="max-w-[7rem]" {...form.register("maxPerUser", { valueAsNumber: true })} />
            <FieldDescription>{t("form.maxHelp", { min: MIN_PER_USER, max: MAX_PER_USER })}</FieldDescription>
            {errors.maxPerUser && <FieldError>{te("badMax", { min: MIN_PER_USER, max: MAX_PER_USER })}</FieldError>}
          </Field>
        </FieldGroup>
        <MemberCardSettings kind="reminder" form={form} cardImage={cardImage} withSubtitle={false} />
        <div>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
