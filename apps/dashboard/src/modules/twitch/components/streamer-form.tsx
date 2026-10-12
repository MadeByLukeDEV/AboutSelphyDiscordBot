"use client";

import { useRef, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { colorToHex, DEFAULT_EMBED_COLOR, hexToColor, TEMPLATE_PLACEHOLDERS } from "@aboutselphy/shared/twitch-template";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveStreamerAction } from "../actions";
import {
  DEFAULT_STREAMER_FORM,
  MAX_TEMPLATE_LENGTH,
  streamerFormSchema,
  type StreamerFormValues,
  type TwitchStreamerView,
} from "../schema";
import { MessagePreview } from "./message-preview";
import { ColorPicker } from "@/components/form/color-picker";

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
          discordUserId: streamer.discordUserId ?? "",
          messageTemplate: streamer.messageTemplate,
          embedColor: streamer.embedColor,
          showThumbnail: streamer.showThumbnail,
          showGame: streamer.showGame,
          enabled: streamer.enabled,
        }
      : DEFAULT_STREAMER_FORM,
  });
  const { errors } = form.formState;
  const templateField = form.register("messageTemplate");
  const templateRef = useRef<HTMLTextAreaElement | null>(null);

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

  const [login, channelId, pingRoleId, template, color, showThumbnail, showGame] = useWatch({
    control: form.control,
    name: ["login", "channelId", "pingRoleId", "messageTemplate", "embedColor", "showThumbnail", "showGame"],
  });
  void channelId;
  const roleName = pingRoleId ? (roleOptions.find((o) => o.value === pingRoleId)?.label ?? null) : null;

  /** Inserts {placeholder} where the cursor is (or replaces the selection). */
  function insert(placeholder: string) {
    const el = templateRef.current;
    const token = `{${placeholder}}`;
    const current = form.getValues("messageTemplate");
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    form.setValue("messageTemplate", next.slice(0, MAX_TEMPLATE_LENGTH), { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const { login: loginValue, ...rest } = values;
      // An existing channel is identified by its id (its login is fixed); a new one by the login to look up.
      const result = await saveStreamerAction(editing ? { id: streamer.id, ...rest } : { login: loginValue, ...rest });
      if (result.ok) {
        toast.success(result.botNotified ? t(editing ? "saved" : "added") : t("savedBotLater"));
        onDone();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  const toggle = (name: "showThumbnail" | "showGame" | "enabled", label: string, help?: string) => (
    <Field orientation="horizontal">
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Switch id={`tw-${name}`} checked={field.value} onCheckedChange={field.onChange} aria-describedby={help ? `tw-${name}-help` : undefined} />
        )}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={`tw-${name}`}>{label}</FieldLabel>
        {help && <FieldDescription id={`tw-${name}-help`}>{help}</FieldDescription>}
      </div>
    </Field>
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

        <Field data-invalid={Boolean(errors.discordUserId) || undefined}>
          <FieldLabel htmlFor="tw-member">{t("member")}</FieldLabel>
          <Input id="tw-member" inputMode="numeric" maxLength={20} autoComplete="off" placeholder={t("memberPlaceholder")} aria-invalid={Boolean(errors.discordUserId) || undefined} {...form.register("discordUserId")} />
          <FieldDescription>{t("memberHelp")}</FieldDescription>
          {errors.discordUserId && <FieldError>{te("memberInvalid")}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.messageTemplate) || undefined}>
          <FieldLabel htmlFor="tw-template">{t("message")}</FieldLabel>
          <Textarea
            id="tw-template"
            rows={3}
            maxLength={MAX_TEMPLATE_LENGTH}
            aria-invalid={Boolean(errors.messageTemplate) || undefined}
            {...templateField}
            ref={(el) => {
              templateField.ref(el);
              templateRef.current = el;
            }}
          />
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("insert")}>
            <span className="text-xs text-muted-foreground">{t("insert")}</span>
            {TEMPLATE_PLACEHOLDERS.map((p) => (
              <Button key={p} type="button" variant="outline" size="xs" onClick={() => insert(p)}>
                {`{${p}}`}
              </Button>
            ))}
          </div>
          <FieldDescription>{t("messageHelp", { count: template.length, max: MAX_TEMPLATE_LENGTH })}</FieldDescription>
          {errors.messageTemplate && <FieldError>{te("invalid")}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.embedColor) || undefined}>
          <FieldLabel htmlFor="tw-color">{t("color")}</FieldLabel>
          <div className="flex items-center gap-2">
            <ColorPicker id="tw-color" value={colorToHex(color)} onChange={(hex) => {
                const next = hexToColor(hex);
                if (next !== undefined) form.setValue("embedColor", next, { shouldDirty: true, shouldValidate: true });
              }} />
            <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("embedColor", DEFAULT_EMBED_COLOR, { shouldDirty: true })}>
              {t("colorReset")}
            </Button>
          </div>
          <FieldDescription>{t("colorHelp")}</FieldDescription>
        </Field>

        {toggle("showGame", t("showGame"))}
        {toggle("showThumbnail", t("showThumbnail"), t("showThumbnailHelp"))}
        {toggle("enabled", t("enabled"))}
      </FieldGroup>

      <MessagePreview
        template={template}
        color={color}
        showThumbnail={showThumbnail}
        showGame={showGame}
        roleName={roleName}
        name={editing ? streamer.displayName : ""}
        login={login.replace(/^@/, "")}
      />

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
