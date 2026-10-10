"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveStreamerAction } from "../actions";
import {
  DEFAULT_STREAMER_FORM,
  MAX_TEMPLATE_LENGTH,
  streamerFormSchema,
  type StreamerFormValues,
  type TwitchStreamerView,
} from "../schema";

/** The form inside the add/edit dialog. `streamer` is the one being edited, or null for a new one. */
export function StreamerForm({
  streamer,
  channels,
  roles,
  onDone,
}: {
  streamer: TwitchStreamerView | null;
  /** Text channels. null = the bot couldn't be reached, so the lists aren't available. */
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
  onDone: () => void;
}) {
  const t = useTranslations("Twitch.form");
  const te = useTranslations("Twitch.errors");
  const [pending, startTransition] = useTransition();
  const editing = streamer !== null;
  const form = useForm<StreamerFormValues>({
    resolver: zodResolver(streamerFormSchema),
    defaultValues: streamer
      ? {
          login: streamer.login,
          channelId: streamer.channelId,
          pingRoleId: streamer.pingRoleId ?? "",
          messageTemplate: streamer.messageTemplate,
          enabled: streamer.enabled,
        }
      : DEFAULT_STREAMER_FORM,
  });
  const { errors } = form.formState;

  // A saved channel or role is always offered, even with the bot offline or the target deleted.
  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({
    value: c.id,
    label: c.parent ? `${c.name} (${c.parent})` : c.name,
    text: c.name,
    group: c.parent ?? undefined,
  }));
  if (streamer && !channelOptions.some((o) => o.value === streamer.channelId)) {
    channelOptions.push({ value: streamer.channelId, label: streamer.channelId });
  }
  const roleOptions: SelectOption[] = [{ value: "", label: t("noRole") }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];
  if (streamer?.pingRoleId && !roleOptions.some((o) => o.value === streamer.pingRoleId)) {
    roleOptions.push({ value: streamer.pingRoleId, label: streamer.pingRoleId });
  }

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const { login, ...rest } = values;
      // An existing channel is identified by its id (its login is fixed); a new one by the login to look up.
      const result = await saveStreamerAction(editing ? { id: streamer.id, ...rest } : { login, ...rest });
      if (result.ok) {
        toast.success(result.botNotified ? t(editing ? "saved" : "added") : t("savedBotLater"));
        onDone();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.login) || undefined}>
          <FieldLabel htmlFor="tw-login">{t("login")}</FieldLabel>
          <Input
            id="tw-login"
            readOnly={editing}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={26}
            aria-invalid={Boolean(errors.login) || undefined}
            {...form.register("login")}
          />
          <FieldDescription>{editing ? t("loginFixed") : t("loginHelp")}</FieldDescription>
          {errors.login && <FieldError>{te("invalidLogin")}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="tw-channel">{t("channel")}</FieldLabel>
          <FormSelect
            control={form.control}
            name="channelId"
            id="tw-channel"
            options={channelOptions}
            placeholder={t("channelPlaceholder")}
            disabled={channels === null}
            invalid={Boolean(errors.channelId)}
          />
          <FieldDescription>{channels === null ? t("botOffline") : t("channelHelp")}</FieldDescription>
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="tw-role">{t("role")}</FieldLabel>
          <FormSelect control={form.control} name="pingRoleId" id="tw-role" options={roleOptions} placeholder={t("noRole")} disabled={roles === null} />
          <FieldDescription>{t("roleHelp")}</FieldDescription>
        </Field>

        <Field data-invalid={Boolean(errors.messageTemplate) || undefined}>
          <FieldLabel htmlFor="tw-template">{t("message")}</FieldLabel>
          <Input id="tw-template" maxLength={MAX_TEMPLATE_LENGTH} aria-invalid={Boolean(errors.messageTemplate) || undefined} {...form.register("messageTemplate")} />
          <FieldDescription>{t("messageHelp")}</FieldDescription>
          {errors.messageTemplate && <FieldError>{te("invalid")}</FieldError>}
        </Field>

        <Field orientation="horizontal">
          <Controller
            control={form.control}
            name="enabled"
            render={({ field }) => <Switch id="tw-streamer-enabled" checked={field.value} onCheckedChange={field.onChange} />}
          />
          <FieldLabel htmlFor="tw-streamer-enabled">{t("enabled")}</FieldLabel>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
