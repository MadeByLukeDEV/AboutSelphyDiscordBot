"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { MAX_AUTO_REJECT_DAYS, screeningSettingsSchema, type ScreeningDecision, type ScreeningSettings } from "@aboutselphy/shared/screening";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { decideScreeningAction, saveScreeningAction } from "../actions";
import type { ScreeningRow } from "../schema";

/** The screening queue: waiting members with Approve / Reject (all staff), and the settings (admins). */
export function ScreeningManager({ initial, entries, channels, roles, canEdit }: { initial: ScreeningSettings; entries: ScreeningRow[]; channels: GuildChannel[] | null; roles: GuildRole[] | null; canEdit: boolean }) {
  const t = useTranslations("Screening");
  const te = useTranslations("Screening.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ScreeningSettings>({ defaultValues: initial });
  const { errors, isDirty } = form.formState;

  const channelOptions: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (initial.channelId && !channelOptions.some((o) => o.value === initial.channelId)) channelOptions.push({ value: initial.channelId, label: initial.channelId });
  const roleOptions: SelectOption[] = [{ value: "", label: t("noRole") }, ...(roles ?? []).filter((r) => r.assignable).map((r) => ({ value: r.id, label: r.name }))];
  for (const id of [initial.approvedRoleId, initial.pendingRoleId]) if (id && !roleOptions.some((o) => o.value === id)) roleOptions.push({ value: id, label: roles?.find((r) => r.id === id)?.name ?? id });

  const save = form.handleSubmit((raw) => {
    const checked = screeningSettingsSchema.safeParse(raw);
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "channelId" || key === "approvedRoleId" || key === "pendingRoleId" || key === "autoRejectDays") form.setError(key, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveScreeningAction(checked.data);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  function decide(id: string, decision: ScreeningDecision) {
    startTransition(async () => {
      const result = await decideScreeningAction({ id, decision });
      if (result.ok) {
        toast.success(decision === "approve" ? t("queue.approved") : t("queue.rejected"));
      } else {
        toast.error(te(`decide.${result.error}`));
      }
      router.refresh();
    });
  }

  const waiting = entries.filter((e) => e.status === "pending");
  const done = entries.filter((e) => e.status !== "pending");
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-6">
      <section className="surface flex flex-col gap-3 p-5" aria-labelledby="sc-waiting">
        <h2 id="sc-waiting" className="text-lg font-semibold">
          {t("queue.waiting", { count: waiting.length })}
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("queue.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {waiting.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.userName}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("queue.account", { date: when(e.accountCreatedAt) })} · {t("queue.joined", { date: when(e.joinedAt) })}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{e.userId}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={pending} onClick={() => decide(e.id, "approve")}>
                    <Check aria-hidden />
                    {t("queue.approve")}
                  </Button>
                  <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => decide(e.id, "reject")}>
                    <X aria-hidden />
                    {t("queue.reject")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="surface flex flex-col gap-3 p-5" aria-labelledby="sc-done">
          <h2 id="sc-done" className="text-lg font-semibold">
            {t("queue.recent")}
          </h2>
          <ul className="flex flex-col divide-y">
            {done.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">{e.userName}</span>
                <span className="text-muted-foreground">
                  {t(`status.${e.status}`)}
                  {e.decidedByName ? ` · ${e.decidedByName}` : ""} · {when(e.decidedAt ?? e.joinedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-5 p-5" noValidate>
          <h2 className="text-lg font-semibold">{t("form.title")}</h2>
          <FieldGroup>
            <Field orientation="horizontal">
              <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="sc-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
              <FieldLabel htmlFor="sc-enabled">{t("form.enabled")}</FieldLabel>
            </Field>
            <Field data-invalid={Boolean(errors.channelId) || undefined}>
              <FieldLabel htmlFor="sc-channel">{t("form.channel")}</FieldLabel>
              <FormSelect control={form.control} name="channelId" id="sc-channel" options={channelOptions} placeholder={t("noChannel")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
              <FieldDescription>{t("form.channelHelp")}</FieldDescription>
              {errors.channelId && <FieldError>{te("needsChannel")}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(errors.approvedRoleId) || undefined}>
              <FieldLabel htmlFor="sc-approved">{t("form.approvedRole")}</FieldLabel>
              <FormSelect control={form.control} name="approvedRoleId" id="sc-approved" options={roleOptions} placeholder={t("noRole")} disabled={roles === null} invalid={Boolean(errors.approvedRoleId)} />
              <FieldDescription>{t("form.approvedRoleHelp")}</FieldDescription>
              {errors.approvedRoleId && <FieldError>{te("needsRole")}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(errors.pendingRoleId) || undefined}>
              <FieldLabel htmlFor="sc-pending">{t("form.pendingRole")}</FieldLabel>
              <FormSelect control={form.control} name="pendingRoleId" id="sc-pending" options={roleOptions} placeholder={t("noRole")} disabled={roles === null} invalid={Boolean(errors.pendingRoleId)} />
              <FieldDescription>{t("form.pendingRoleHelp")}</FieldDescription>
              {errors.pendingRoleId && <FieldError>{te("sameRole")}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(errors.autoRejectDays) || undefined}>
              <FieldLabel htmlFor="sc-auto">{t("form.autoReject")}</FieldLabel>
              <Input id="sc-auto" type="number" inputMode="numeric" min={0} max={MAX_AUTO_REJECT_DAYS} className="max-w-[8rem]" {...form.register("autoRejectDays", { valueAsNumber: true })} />
              <FieldDescription>{t("form.autoRejectHelp")}</FieldDescription>
              {errors.autoRejectDays && <FieldError>{te("badDays", { max: MAX_AUTO_REJECT_DAYS })}</FieldError>}
            </Field>
          </FieldGroup>
          <div>
            <Button type="submit" disabled={pending || !isDirty}>
              {pending ? t("form.saving") : t("form.save")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
