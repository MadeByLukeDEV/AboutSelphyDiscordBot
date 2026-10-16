"use client";

import { SaveRow } from "@/components/page/save-row";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { MAX_ACCOUNT_AGE_DAYS, MAX_KICK_AFTER_HOURS, verificationSettingsSchema, type VerificationSettings } from "@aboutselphy/shared/entry";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { postVerificationPanelAction, saveVerificationAction } from "../actions";
import { EmoteInsert } from "@/components/form/emote-insert";

/** The verification gate: settings, the panel button, and the optional automatic kick. */
export function VerificationManager({ initial, panelPosted, channels, roles }: { initial: VerificationSettings; panelPosted: boolean; channels: GuildChannel[] | null; roles: GuildRole[] | null }) {
  const t = useTranslations("Verification");
  const te = useTranslations("Verification.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<VerificationSettings>({ defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const [enabled, kickAfterHours] = useWatch({ control: form.control, name: ["enabled", "kickAfterHours"] });

  const channelOptions: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (initial.channelId && !channelOptions.some((o) => o.value === initial.channelId)) channelOptions.push({ value: initial.channelId, label: initial.channelId });
  const roleOptions = (empty: string): SelectOption[] => {
    const list: SelectOption[] = [{ value: "", label: empty }, ...(roles ?? []).filter((r) => r.assignable).map((r) => ({ value: r.id, label: r.name }))];
    for (const id of [initial.verifiedRoleId, initial.unverifiedRoleId]) if (id && !list.some((o) => o.value === id)) list.push({ value: id, label: roles?.find((r) => r.id === id)?.name ?? id });
    return list;
  };

  const save = form.handleSubmit((raw) => {
    const checked = verificationSettingsSchema.safeParse({ ...raw, minAccountAgeDays: Number(raw.minAccountAgeDays), kickAfterHours: Number(raw.kickAfterHours) });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "channelId" || key === "verifiedRoleId" || key === "unverifiedRoleId" || key === "answer") form.setError(key, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveVerificationAction(checked.data);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  function post() {
    startTransition(async () => {
      const result = await postVerificationPanelAction();
      if (result.ok) {
        toast.success(result.status === "posted" ? t("panel.posted") : t("panel.updated"));
        router.refresh();
      } else {
        toast.error(te(`panel.${result.error}`));
      }
    });
  }

  return (
    <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-5 p-5" noValidate>
      <FieldGroup>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="vf-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="vf-enabled">{t("form.enabled")}</FieldLabel>
        </Field>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="vf-channel">{t("form.channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="vf-channel" options={channelOptions} placeholder={t("noChannel")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
          <FieldDescription>{t("form.channelHelp")}</FieldDescription>
          {errors.channelId && <FieldError>{te("needsChannel")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.verifiedRoleId) || undefined}>
          <FieldLabel htmlFor="vf-role">{t("form.verifiedRole")}</FieldLabel>
          <FormSelect control={form.control} name="verifiedRoleId" id="vf-role" options={roleOptions(t("noRole"))} placeholder={t("noRole")} disabled={roles === null} invalid={Boolean(errors.verifiedRoleId)} />
          <FieldDescription>{t("form.verifiedRoleHelp")}</FieldDescription>
          {errors.verifiedRoleId && <FieldError>{te("needsRole")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.unverifiedRoleId) || undefined}>
          <FieldLabel htmlFor="vf-unverified">{t("form.unverifiedRole")}</FieldLabel>
          <FormSelect control={form.control} name="unverifiedRoleId" id="vf-unverified" options={roleOptions(t("noRole"))} placeholder={t("noRole")} disabled={roles === null} invalid={Boolean(errors.unverifiedRoleId)} />
          <FieldDescription>{t("form.unverifiedRoleHelp")}</FieldDescription>
          {errors.unverifiedRoleId && <FieldError>{te("sameRole")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="vf-title">{t("form.panelTitle")}</FieldLabel>
          <Input id="vf-title" maxLength={256} {...form.register("panelTitle")} />
<EmoteInsert targetId="vf-title" />
        </Field>
        <Field>
          <FieldLabel htmlFor="vf-desc">{t("form.panelDescription")}</FieldLabel>
          <Textarea id="vf-desc" rows={3} maxLength={2000} {...form.register("panelDescription")} />
<EmoteInsert targetId="vf-desc" />
        </Field>
        <Field>
          <FieldLabel htmlFor="vf-button">{t("form.buttonLabel")}</FieldLabel>
          <Input id="vf-button" maxLength={80} className="max-w-[16rem]" {...form.register("buttonLabel")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="vf-question">{t("form.question")}</FieldLabel>
          <Input id="vf-question" maxLength={200} {...form.register("question")} />
          <FieldDescription>{t("form.questionHelp")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.answer) || undefined}>
          <FieldLabel htmlFor="vf-answer">{t("form.answer")}</FieldLabel>
          <Input id="vf-answer" maxLength={100} className="max-w-[20rem]" autoComplete="off" {...form.register("answer")} />
          <FieldDescription>{t("form.answerHelp")}</FieldDescription>
          {errors.answer && <FieldError>{te("needsAnswer")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="vf-age">{t("form.minAge")}</FieldLabel>
          <Input id="vf-age" type="number" inputMode="numeric" min={0} max={MAX_ACCOUNT_AGE_DAYS} className="max-w-[8rem]" {...form.register("minAccountAgeDays", { valueAsNumber: true })} />
          <FieldDescription>{t("form.minAgeHelp")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="vf-kick">{t("form.kickAfter")}</FieldLabel>
          <Input id="vf-kick" type="number" inputMode="numeric" min={0} max={MAX_KICK_AFTER_HOURS} className="max-w-[8rem]" {...form.register("kickAfterHours", { valueAsNumber: true })} />
          <FieldDescription>{t("form.kickAfterHelp")}</FieldDescription>
        </Field>
      </FieldGroup>
      {enabled && Number(kickAfterHours) > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          {t("form.kickWarning", { hours: Number(kickAfterHours) })}
        </p>
      )}
      <SaveRow dirty={isDirty} pending={pending} label={t("form.save")} savingLabel={t("form.saving")}>
        <Button type="button" variant="outline" disabled={pending || isDirty || !initial.channelId || !initial.verifiedRoleId} onClick={post}>
          <Send aria-hidden />
          {panelPosted ? t("panel.update") : t("panel.post")}
        </Button>
        {isDirty && <p className="text-sm text-muted-foreground">{t("panel.saveFirst")}</p>}
      </SaveRow>
    </form>
  );
}
