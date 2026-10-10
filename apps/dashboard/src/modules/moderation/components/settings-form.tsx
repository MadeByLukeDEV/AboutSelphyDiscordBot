"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { FormSelect } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { saveSettingsAction } from "../actions";
import { settingsSchema, type SettingsInput } from "../schema";

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

  // "#general (Chat)". The saved channel is always offered, even if the bot is
  // offline or the channel was deleted, so the field never shows a blank.
  const options = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}` })),
  ];
  if (initial.logChannelId && !options.some((o) => o.value === initial.logChannelId)) {
    options.push({ value: initial.logChannelId, label: initial.logChannelId });
  }

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("saved") : t("savedBotLater"));
        form.reset({ logChannelId: result.logChannelId, dmOnAction: result.dmOnAction });
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
