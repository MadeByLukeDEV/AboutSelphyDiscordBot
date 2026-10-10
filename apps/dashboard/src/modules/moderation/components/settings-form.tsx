"use client";

import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveSettingsAction } from "../actions";
import { ESCALATION_ACTIONS, MAX_ESCALATION_WARNINGS, MIN_ESCALATION_WARNINGS, settingsSchema, type SettingsInput } from "../schema";

const DURATION_ERRORS = ["unreadable", "timeoutRange", "kickNoDuration", "tooShort"] as const;

export function SettingsForm({
  initial,
  channels,
  canEdit,
}: {
  initial: SettingsInput;
  /** null = the bot couldn't be reached, so the list isn't available. */
  channels: GuildChannel[] | null;
  canEdit: boolean;
}) {
  const t = useTranslations("Moderation.settings");
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const escalationOn = useWatch({ control: form.control, name: "escalationEnabled" });
  const escalationAction = useWatch({ control: form.control, name: "escalationAction" });
  const actionOptions: SelectOption[] = ESCALATION_ACTIONS.map((a) => ({ value: a, label: t(`escalation.actions.${a}`) }));

  // The bot sends channels in Discord's own order (uncategorised first, then
  // each category, text before voice), and the list keeps it, with the category
  // as a heading. The closed field says "#general (Chat)" because several
  // categories can have a channel of the same name. The saved channel is always
  // offered, even if the bot is offline or the channel was deleted, so the
  // field never shows a blank.
  const options: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({
      value: c.id,
      label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`,
      text: `#${c.name}`,
      group: c.parent ?? undefined,
    })),
  ];
  if (initial.logChannelId && !options.some((o) => o.value === initial.logChannelId)) {
    options.push({ value: initial.logChannelId, label: initial.logChannelId });
  }

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("saved") : t("savedBotLater"));
        form.reset(result.settings);
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.logChannelId) || undefined}>
          <FieldLabel htmlFor="logChannelId">{t("logChannel")}</FieldLabel>
          <FormSelect
            control={form.control}
            name="logChannelId"
            id="logChannelId"
            options={options}
            placeholder={t("channelPlaceholder")}
            disabled={!canEdit || channels === null}
            invalid={Boolean(errors.logChannelId)}
          />
          <FieldDescription>{channels === null ? t("botOffline") : t("logChannelHelp")}</FieldDescription>
          {errors.logChannelId && <FieldError>{t("errors.invalid")}</FieldError>}
        </Field>

        <Field orientation="horizontal">
          <Controller
            control={form.control}
            name="dmOnAction"
            render={({ field }) => (
              <Switch
                id="dmOnAction"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!canEdit}
                aria-describedby="dmOnAction-help"
              />
            )}
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="dmOnAction">{t("dm")}</FieldLabel>
            <FieldDescription id="dmOnAction-help">{t("dmHelp")}</FieldDescription>
          </div>
        </Field>
      </FieldGroup>

      <section aria-labelledby="escalation-heading" className="surface flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 id="escalation-heading" className="text-fluid-lg font-bold">
            {t("escalation.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("escalation.intro")}</p>
        </div>
        <FieldGroup>
          <Field orientation="horizontal">
            <Controller
              control={form.control}
              name="escalationEnabled"
              render={({ field }) => (
                <Switch id="escalationEnabled" checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} />
              )}
            />
            <FieldLabel htmlFor="escalationEnabled">{t("escalation.enabled")}</FieldLabel>
          </Field>

          {escalationOn && (
            <>
              <Field data-invalid={Boolean(errors.escalationThreshold) || undefined}>
                <FieldLabel htmlFor="escalationThreshold">{t("escalation.warnings")}</FieldLabel>
                <Input
                  id="escalationThreshold"
                  type="number"
                  inputMode="numeric"
                  min={MIN_ESCALATION_WARNINGS}
                  max={MAX_ESCALATION_WARNINGS}
                  className="max-w-[8rem]"
                  disabled={!canEdit}
                  aria-invalid={Boolean(errors.escalationThreshold) || undefined}
                  {...form.register("escalationThreshold", { valueAsNumber: true })}
                />
                <FieldDescription>{t("escalation.warningsHelp", { min: MIN_ESCALATION_WARNINGS, max: MAX_ESCALATION_WARNINGS })}</FieldDescription>
                {errors.escalationThreshold && <FieldError>{t("errors.invalid")}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="escalationAction">{t("escalation.action")}</FieldLabel>
                <FormSelect control={form.control} name="escalationAction" id="escalationAction" options={actionOptions} placeholder={t("escalation.action")} disabled={!canEdit} />
              </Field>

              {escalationAction !== "kick" && (
                <Field data-invalid={Boolean(errors.escalationDuration) || undefined}>
                  <FieldLabel htmlFor="escalationDuration">{t(`escalation.duration.${escalationAction}`)}</FieldLabel>
                  <Input
                    id="escalationDuration"
                    className="max-w-[10rem]"
                    autoComplete="off"
                    maxLength={20}
                    disabled={!canEdit}
                    aria-invalid={Boolean(errors.escalationDuration) || undefined}
                    {...form.register("escalationDuration")}
                  />
                  <FieldDescription>{t(`escalation.durationHelp.${escalationAction}`)}</FieldDescription>
                  {errors.escalationDuration && <FieldError>{t(`escalation.durationErrors.${DURATION_ERRORS.find((k) => k === errors.escalationDuration?.message) ?? "unreadable"}`)}</FieldError>}
                </Field>
              )}
            </>
          )}
        </FieldGroup>
      </section>

      {canEdit ? (
        <div>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>
      )}
    </form>
  );
}
