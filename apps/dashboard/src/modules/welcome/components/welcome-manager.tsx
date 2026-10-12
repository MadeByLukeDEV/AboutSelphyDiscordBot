"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { MAX_IMAGE_URL } from "@aboutselphy/shared/announcement";
import { colorToHex, hexToColor } from "@aboutselphy/shared/twitch-template";
import {
  DEFAULT_WELCOME_COLOR,
  fillWelcome,
  MAX_AUTO_ROLES,
  MAX_WELCOME_TEMPLATE,
  WELCOME_PLACEHOLDERS,
  welcomeSettingsSchema,
  type WelcomeSettings,
} from "@aboutselphy/shared/welcome";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveWelcomeSettingsAction } from "../actions";
import type { CardImageView } from "../schema";
import { CardSettings } from "./card-settings";
import { RolePicker } from "./role-picker";
import { TemplateList } from "./template-list";
import { ColorPicker } from "@/components/form/color-picker";

type TemplateField = "dmTemplate" | "goodbyeTemplate";

/** All the welcome settings in one form: auto-roles, restoring roles, and the welcome, direct and goodbye messages. */
export function WelcomeManager({
  initial,
  channels,
  roles,
  cardImage,
}: {
  initial: WelcomeSettings;
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
  cardImage: CardImageView | null;
}) {
  const t = useTranslations("Welcome");
  const te = useTranslations("Welcome.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Bumped after every save so the card preview is drawn again from the new settings.
  const [version, setVersion] = useState(0);
  const form = useForm<WelcomeSettings>({ resolver: zodResolver(welcomeSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;

  const v = useWatch({ control: form.control });

  const channelOptions: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  for (const saved of [initial.welcomeChannelId, initial.goodbyeChannelId]) {
    if (saved && !channelOptions.some((o) => o.value === saved)) channelOptions.push({ value: saved, label: saved });
  }

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveWelcomeSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        setVersion((n) => n + 1);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  /** Inserts {placeholder} where the cursor is in one of the message fields. */
  function insert(field: TemplateField, placeholder: string) {
    const el = document.getElementById(`w-${field}`) as HTMLTextAreaElement | null;
    const token = `{${placeholder}}`;
    const current = form.getValues(field);
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    form.setValue(field, `${current.slice(0, start)}${token}${current.slice(end)}`.slice(0, MAX_WELCOME_TEMPLATE), { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const sample = { user: "@NewMember", username: "NewMember", server: t("preview.server"), count: "1234" };
  const fill = (text: string | undefined) => fillWelcome(text ?? "", sample);

  const toggle = (name: "restoreRoles" | "welcomeEnabled" | "welcomeAsEmbed" | "dmEnabled" | "goodbyeEnabled", label: string, help?: string) => (
    <Field orientation="horizontal">
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => <Switch id={`w-${name}`} checked={field.value} onCheckedChange={field.onChange} aria-describedby={help ? `w-${name}-help` : undefined} />}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={`w-${name}`}>{label}</FieldLabel>
        {help && <FieldDescription id={`w-${name}-help`}>{help}</FieldDescription>}
      </div>
    </Field>
  );

  const templateField = (name: TemplateField, label: string, help: string) => (
    <Field data-invalid={Boolean(errors[name]) || undefined}>
      <FieldLabel htmlFor={`w-${name}`}>{label}</FieldLabel>
      <Textarea id={`w-${name}`} rows={3} maxLength={MAX_WELCOME_TEMPLATE} aria-invalid={Boolean(errors[name]) || undefined} {...form.register(name)} />
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("form.insert")}>
        <span className="text-xs text-muted-foreground">{t("form.insert")}</span>
        {WELCOME_PLACEHOLDERS.filter((p) => name !== "dmTemplate" || p !== "user").map((p) => (
          <Button key={p} type="button" variant="outline" size="xs" onClick={() => insert(name, p)}>
            {`{${p}}`}
          </Button>
        ))}
      </div>
      <FieldDescription>{help}</FieldDescription>
      {errors[name] && <FieldError>{te("invalid")}</FieldError>}
    </Field>
  );

  const channelField = (name: "welcomeChannelId" | "goodbyeChannelId", label: string) => (
    <Field data-invalid={Boolean(errors[name]) || undefined}>
      <FieldLabel htmlFor={`w-${name}`}>{label}</FieldLabel>
      <FormSelect control={form.control} name={name} id={`w-${name}`} options={channelOptions} placeholder={t("form.channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors[name])} />
      <FieldDescription>{channels === null ? t("form.botOffline") : t("form.channelHelp")}</FieldDescription>
      {errors[name] && <FieldError>{te("needsChannel")}</FieldError>}
    </Field>
  );

  const card = (id: string, title: string, body: string, children: React.ReactNode) => (
    <section aria-labelledby={id} className="surface flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-fluid-lg font-bold">
          {title}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
      </div>
      <FieldGroup>{children}</FieldGroup>
    </section>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-fluid" noValidate>
      {card(
        "w-roles",
        t("roles.title"),
        t("roles.intro"),
        <>
          <Field>
            <FieldLabel htmlFor="w-auto">{t("roles.members", { max: MAX_AUTO_ROLES })}</FieldLabel>
            <Controller control={form.control} name="autoRoleIds" render={({ field }) => <RolePicker id="w-auto" value={field.value} onChange={field.onChange} roles={roles} max={MAX_AUTO_ROLES} />} />
            {errors.autoRoleIds && <FieldError>{te("invalid")}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="w-bots">{t("roles.bots", { max: MAX_AUTO_ROLES })}</FieldLabel>
            <Controller control={form.control} name="botAutoRoleIds" render={({ field }) => <RolePicker id="w-bots" value={field.value} onChange={field.onChange} roles={roles} max={MAX_AUTO_ROLES} />} />
          </Field>
          {toggle("restoreRoles", t("roles.restore"), t("roles.restoreHelp"))}
        </>,
      )}

      {card(
        "w-welcome",
        t("welcome.title"),
        t("welcome.intro"),
        <>
          {toggle("welcomeEnabled", t("welcome.enabled"))}
          {channelField("welcomeChannelId", t("welcome.channel"))}
          <Controller
            control={form.control}
            name="welcomeTemplates"
            render={({ field }) => <TemplateList value={field.value} onChange={field.onChange} invalid={Boolean(errors.welcomeTemplates)} />}
          />
          {errors.welcomeTemplates && <FieldError>{te("needsText")}</FieldError>}
          {toggle("welcomeAsEmbed", t("welcome.embed"), t("welcome.embedHelp"))}
          {v.welcomeAsEmbed && (
            <>
              <Field data-invalid={Boolean(errors.welcomeImageUrl) || undefined}>
                <FieldLabel htmlFor="w-image">{t("welcome.image")}</FieldLabel>
                <Input id="w-image" type="url" inputMode="url" autoComplete="off" maxLength={MAX_IMAGE_URL} placeholder="https://" aria-invalid={Boolean(errors.welcomeImageUrl) || undefined} {...form.register("welcomeImageUrl")} />
                <FieldDescription>{t("welcome.imageHelp")}</FieldDescription>
                {errors.welcomeImageUrl && <FieldError>{te("imageInvalid")}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="w-color">{t("welcome.color")}</FieldLabel>
                <div className="flex items-center gap-2">
                  <ColorPicker id="w-color" value={colorToHex(v.welcomeColor ?? DEFAULT_WELCOME_COLOR)} onChange={(hex) => {
                      const next = hexToColor(hex);
                      if (next !== undefined) form.setValue("welcomeColor", next, { shouldDirty: true });
                    }} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("welcomeColor", DEFAULT_WELCOME_COLOR, { shouldDirty: true })}>
                    {t("welcome.colorReset")}
                  </Button>
                </div>
              </Field>
            </>
          )}

          <CardSettings form={form} cardImage={cardImage} version={version} />

          <figure aria-label={t("preview.label")} className="flex flex-col gap-2">
            <figcaption className="text-xs font-medium text-muted-foreground">{t("preview.label")}</figcaption>
            <div className="flex gap-3 rounded-xl bg-[#313338] p-3 text-[#dbdee1]">
              <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                AS
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-sm font-semibold text-white">{t("preview.botName")}</p>
                {v.welcomeAsEmbed ? (
                  <>
                    <p className="text-sm"><span className="rounded bg-[#5865f2]/30 px-1 font-medium text-[#c9cdfb]">@NewMember</span></p>
                    <div className="flex max-w-[30rem] overflow-hidden rounded bg-[#2b2d31]">
                      <span className="w-1 shrink-0" style={{ backgroundColor: colorToHex(v.welcomeColor ?? DEFAULT_WELCOME_COLOR) }} aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                        <p className="text-sm break-words whitespace-pre-wrap">{fill(v.welcomeTemplates?.[0])}</p>
                        {(v.welcomeImageUrl ?? "").trim() !== "" && (
                          <div aria-hidden className="mt-1 flex aspect-video w-full items-center justify-center rounded bg-[#1e1f22] text-xs text-[#949ba4]">
                            {t("preview.picture")}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm break-words whitespace-pre-wrap">{fill(v.welcomeTemplates?.[0])}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{(v.welcomeTemplates?.length ?? 0) > 1 ? t("preview.variants", { count: v.welcomeTemplates?.length ?? 0 }) : t("preview.note")}</p>
          </figure>
        </>,
      )}

      {card(
        "w-dm",
        t("dm.title"),
        t("dm.intro"),
        <>
          {toggle("dmEnabled", t("dm.enabled"))}
          {templateField("dmTemplate", t("dm.message"), t("dm.messageHelp"))}
        </>,
      )}

      {card(
        "w-goodbye",
        t("goodbye.title"),
        t("goodbye.intro"),
        <>
          {toggle("goodbyeEnabled", t("goodbye.enabled"))}
          {channelField("goodbyeChannelId", t("goodbye.channel"))}
          {templateField("goodbyeTemplate", t("goodbye.message"), t("goodbye.messageHelp"))}
        </>,
      )}

      <div>
        <Button type="submit" disabled={pending || !isDirty}>
          {pending ? t("form.saving") : t("form.save")}
        </Button>
      </div>
    </form>
  );
}
