"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveTempVoiceSettingsAction } from "../actions";
import { fromFormValues, settingsFormSchema, toFormValues, type SettingsFormValues, type SettingsInput } from "../schema";

export function SettingsForm({
  initial,
  channels,
}: {
  initial: SettingsInput;
  /** null = the bot couldn't be reached, so the lists aren't available. */
  channels: GuildChannel[] | null;
}) {
  const t = useTranslations("TempVoice.settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsFormValues>({ resolver: zodResolver(settingsFormSchema), defaultValues: toFormValues(initial) });
  const { errors, isDirty } = form.formState;

  // Channels arrive in Discord's own order. The closed field shows "Lobby (Category)"
  // because names repeat across categories; the list groups them under the category.
  // A saved channel is always offered, even with the bot offline or the channel
  // deleted, so a field never shows blank.
  const withSaved = (options: SelectOption[], saved: string) =>
    saved && !options.some((o) => o.value === saved) ? [...options, { value: saved, label: saved }] : options;

  const lobbyOptions = withSaved(
    [
      { value: "", label: t("noLobby") },
      ...(channels ?? [])
        .filter((c) => c.kind === "voice")
        .map((c) => ({
          value: c.id,
          label: c.parent ? `${c.name} (${c.parent})` : c.name,
          text: c.name,
          group: c.parent ?? undefined,
        })),
    ],
    initial.lobbyChannelId,
  );
  const categoryOptions = withSaved(
    [{ value: "", label: t("noCategory") }, ...(channels ?? []).filter((c) => c.kind === "category").map((c) => ({ value: c.id, label: c.name }))],
    initial.categoryId,
  );

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveTempVoiceSettingsAction(fromFormValues(values));
      if (result.ok) {
        toast.success(result.botNotified ? t("saved") : t("savedBotLater"));
        form.reset(toFormValues(result.settings));
        router.refresh(); // the live view above needs the new on/off state
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    }),
  );

  const switchField = (name: "enabled" | "allowVideoByDefault" | "allowSoundboardByDefault", label: string, help?: string) => (
    <Field orientation="horizontal">
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Switch id={name} checked={field.value} onCheckedChange={field.onChange} aria-describedby={help ? `${name}-help` : undefined} />
        )}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        {help && <FieldDescription id={`${name}-help`}>{help}</FieldDescription>}
      </div>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6" noValidate>
      {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}

      <FieldGroup>
        {switchField("enabled", t("enabled"), t("enabledHelp"))}
        {errors.enabled && <FieldError>{t("errors.needsLobby")}</FieldError>}

        <Field data-invalid={Boolean(errors.lobbyChannelId) || undefined}>
          <FieldLabel htmlFor="lobbyChannelId">{t("lobby")}</FieldLabel>
          <FormSelect
            control={form.control}
            name="lobbyChannelId"
            id="lobbyChannelId"
            options={lobbyOptions}
            placeholder={t("lobbyPlaceholder")}
            disabled={channels === null}
            invalid={Boolean(errors.lobbyChannelId)}
          />
          <FieldDescription>{t("lobbyHelp")}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="categoryId">{t("category")}</FieldLabel>
          <FormSelect
            control={form.control}
            name="categoryId"
            id="categoryId"
            options={categoryOptions}
            placeholder={t("categoryPlaceholder")}
            disabled={channels === null}
          />
          <FieldDescription>{t("categoryHelp")}</FieldDescription>
        </Field>

        <Field data-invalid={Boolean(errors.nameTemplate) || undefined}>
          <FieldLabel htmlFor="nameTemplate">{t("nameTemplate")}</FieldLabel>
          <Input id="nameTemplate" maxLength={100} aria-invalid={Boolean(errors.nameTemplate) || undefined} {...form.register("nameTemplate")} />
          <FieldDescription>{t("nameTemplateHelp")}</FieldDescription>
          {errors.nameTemplate && <FieldError>{t("errors.invalid")}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.defaultUserLimit) || undefined}>
          <FieldLabel htmlFor="defaultUserLimit">{t("defaultLimit")}</FieldLabel>
          <Input
            id="defaultUserLimit"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            className="max-w-[8rem]"
            aria-invalid={Boolean(errors.defaultUserLimit) || undefined}
            {...form.register("defaultUserLimit", { valueAsNumber: true })}
          />
          <FieldDescription>{t("defaultLimitHelp")}</FieldDescription>
          {errors.defaultUserLimit && <FieldError>{t("errors.invalid")}</FieldError>}
        </Field>

        {switchField("allowVideoByDefault", t("video"))}
        {switchField("allowSoundboardByDefault", t("soundboard"), t("defaultsHelp"))}

        <Field data-invalid={Boolean(errors.blockedWordsText) || undefined}>
          <FieldLabel htmlFor="blockedWordsText">{t("blocked")}</FieldLabel>
          <Textarea id="blockedWordsText" rows={5} {...form.register("blockedWordsText")} />
          <FieldDescription>{t("blockedHelp")}</FieldDescription>
          {errors.blockedWordsText && <FieldError>{t("errors.invalid")}</FieldError>}
        </Field>
      </FieldGroup>

      <div>
        <Button type="submit" disabled={pending || !isDirty}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
