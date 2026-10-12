"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { MAX_RETENTION_DAYS, RETENTION_FIELDS, retentionSettingsSchema, type RetentionSettings } from "@aboutselphy/shared/retention";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveRetentionAction } from "../actions";
import type { RetentionLastRun } from "../schema";

/** A limit that removes more than before: from keep (0) to some days, or to fewer days. */
const stricter = (before: number, after: number) => after > 0 && (before === 0 || after < before);

/** The retention limits, with a confirmation whenever a change will remove data that exists now. */
export function RetentionManager({ initial, last }: { initial: RetentionSettings; last: RetentionLastRun }) {
  const t = useTranslations("Retention");
  const te = useTranslations("Retention.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [understood, setUnderstood] = useState(false);

  const form = useForm<RetentionSettings>({ defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const values = useWatch({ control: form.control });
  const removesMore = RETENTION_FIELDS.some((f) => stricter(initial[f], Number(values[f] ?? 0)));

  const save = form.handleSubmit((raw) => {
    const checked = retentionSettingsSchema.safeParse(Object.fromEntries(RETENTION_FIELDS.map((f) => [f, Number(raw[f])])));
    if (!checked.success) return void toast.error(te("invalid"));
    startTransition(async () => {
      const result = await saveRetentionAction(checked.data);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        setUnderstood(false);
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  return (
    <div className="flex flex-col gap-fluid">
      <section className="surface flex flex-col gap-1 p-5" aria-labelledby="rt-last">
        <h2 id="rt-last" className="text-fluid-lg font-bold">
          {t("last.title")}
        </h2>
        {last.at ? (
          <>
            <p className="text-sm text-muted-foreground">{t("last.when", { time: format.dateTime(new Date(last.at), { dateStyle: "medium", timeStyle: "short" }) })}</p>
            <p className="text-sm">{last.result}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("last.never")}</p>
        )}
      </section>

      <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-5 p-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
        </div>
        <FieldGroup>
          {RETENTION_FIELDS.map((f) => (
            <Field key={f} data-invalid={Boolean(errors[f]) || undefined}>
              <FieldLabel htmlFor={`rt-${f}`}>{t(`fields.${f}.label`)}</FieldLabel>
              <Input id={`rt-${f}`} type="number" inputMode="numeric" min={0} max={MAX_RETENTION_DAYS} className="max-w-[9rem]" {...form.register(f, { valueAsNumber: true })} />
              <FieldDescription>{t(`fields.${f}.help`)}</FieldDescription>
              {errors[f] && <FieldError>{te("invalid")}</FieldError>}
            </Field>
          ))}
        </FieldGroup>
        {removesMore && (
          <label className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span className="flex flex-1 flex-col gap-2">
              {t("form.warning")}
              <span className="flex items-center gap-2 font-medium">
                <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                {t("form.understood")}
              </span>
            </span>
          </label>
        )}
        <div>
          <Button type="submit" disabled={pending || !isDirty || (removesMore && !understood)}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
