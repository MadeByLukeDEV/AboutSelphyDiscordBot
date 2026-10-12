"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import {
  announcementInput,
  DEFAULT_ANNOUNCEMENT_COLOR,
  MAX_CONTENT,
  MAX_EMBED_DESCRIPTION,
  MAX_EMBED_TITLE,
  MAX_IMAGE_URL,
  MIN_SCHEDULE_AHEAD_MS,
  type AnnouncementMode,
} from "@aboutselphy/shared/announcement";
import { FormDateTime } from "@/components/form/date-time-picker";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveAnnouncementAction } from "../actions";
import { colorToHexString, hexStringToColor, toLocalInputValue } from "../color";
import type { AnnouncementView } from "../schema";
import { AnnouncementPreview } from "./announcement-preview";

type FormValues = {
  content: string;
  embedEnabled: boolean;
  embedTitle: string;
  embedDescription: string;
  embedColor: number;
  embedImageUrl: string;
  channelId: string;
  pingRoleId: string;
  mode: AnnouncementMode;
  /** datetime-local value in the browser's time zone. */
  scheduledLocal: string;
};

type ErrorKey = "content" | "embedImageUrl" | "scheduledFor" | "channelId";

const DEFAULTS: FormValues = {
  content: "",
  embedEnabled: false,
  embedTitle: "",
  embedDescription: "",
  embedColor: DEFAULT_ANNOUNCEMENT_COLOR,
  embedImageUrl: "",
  channelId: "",
  pingRoleId: "",
  mode: "draft",
  scheduledLocal: "",
};

/** The form inside the composer dialog. `announcement` is the one being edited, or null for a new one. */
export function AnnouncementForm({
  announcement,
  channels,
  roles,
  onDone,
}: {
  announcement: AnnouncementView | null;
  /** Text channels. null = the bot couldn't be reached, so the lists aren't available. */
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
  onDone: () => void;
}) {
  const t = useTranslations("Announcements.form");
  const te = useTranslations("Announcements.errors");
  const [pending, startTransition] = useTransition();
  const sent = announcement?.status === "sent";
  // Computed once when the form opens (not on every render): the earliest time that can be scheduled.
  const [minLocal] = useState(() => toLocalInputValue(new Date(Date.now() + MIN_SCHEDULE_AHEAD_MS)));

  const form = useForm<FormValues>({
    defaultValues: announcement
      ? {
          content: announcement.content,
          embedEnabled: announcement.embedEnabled,
          embedTitle: announcement.embedTitle,
          embedDescription: announcement.embedDescription,
          embedColor: announcement.embedColor,
          embedImageUrl: announcement.embedImageUrl,
          channelId: announcement.channelId,
          pingRoleId: announcement.pingRoleId,
          mode: announcement.status === "scheduled" ? "schedule" : "draft",
          scheduledLocal: announcement.scheduledFor ? toLocalInputValue(new Date(announcement.scheduledFor)) : "",
        }
      : DEFAULTS,
  });
  const { errors } = form.formState;

  const [content, embedEnabled, embedTitle, embedDescription, embedColor, embedImageUrl, pingRoleId, mode] = useWatch({
    control: form.control,
    name: ["content", "embedEnabled", "embedTitle", "embedDescription", "embedColor", "embedImageUrl", "pingRoleId", "mode"],
  });

  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({
    value: c.id,
    label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`,
    text: `#${c.name}`,
    group: c.parent ?? undefined,
  }));
  if (announcement && !channelOptions.some((o) => o.value === announcement.channelId)) {
    channelOptions.push({ value: announcement.channelId, label: announcement.channelId });
  }
  const roleOptions: SelectOption[] = [{ value: "", label: t("noRole") }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];
  if (announcement?.pingRoleId && !roleOptions.some((o) => o.value === announcement.pingRoleId)) {
    roleOptions.push({ value: announcement.pingRoleId, label: announcement.pingRoleId });
  }
  const modeOptions: SelectOption[] = (["draft", "now", "schedule"] as const).map((m) => ({ value: m, label: t(`modes.${m}`) }));
  const roleName = pingRoleId ? (roleOptions.find((o) => o.value === pingRoleId)?.label ?? null) : null;

  const submit = form.handleSubmit((values) => {
    const scheduleTime = values.mode === "schedule" && values.scheduledLocal ? new Date(values.scheduledLocal) : null;
    const payload = {
      ...(announcement ? { id: announcement.id } : {}),
      content: values.content,
      embedEnabled: values.embedEnabled,
      embedTitle: values.embedTitle,
      embedDescription: values.embedDescription,
      embedColor: values.embedColor,
      embedImageUrl: values.embedImageUrl.trim(),
      channelId: values.channelId,
      pingRoleId: values.pingRoleId,
      mode: sent ? ("draft" as const) : values.mode,
      scheduledFor: scheduleTime && !Number.isNaN(scheduleTime.getTime()) ? scheduleTime.toISOString() : undefined,
    };
    const checked = announcementInput.safeParse(payload);
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "content" || key === "embedImageUrl" || key === "scheduledFor" || key === "channelId") {
          form.setError(key === "scheduledFor" ? "scheduledLocal" : key, { type: "custom", message: issue.message });
        }
      }
      return;
    }
    startTransition(async () => {
      const result = await saveAnnouncementAction(checked.data);
      if (result.ok) {
        if (sent) toast.success(result.discordUpdated ? t("updatedInDiscord") : t("savedNotUpdated"));
        else toast.success(result.botNotified ? t(`done.${values.mode}`) : t("savedBotLater"));
        onDone();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  const fieldError = (name: keyof FormValues, kind: ErrorKey) => {
    const message = errors[name]?.message;
    if (!message) return null;
    const known = ["empty", "image", "time", "past", "tooFar"] as const;
    const code = known.find((k) => k === message);
    return <FieldError>{code ? te(`field.${code}`) : kind === "channelId" ? t("channelRequired") : te("invalid")}</FieldError>;
  };

  const submitLabel = sent ? t("saveSent") : mode === "now" ? t("sendNow") : mode === "schedule" ? t("schedule") : t("saveDraft");

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="ann-channel">{t("channel")}</FieldLabel>
          <FormSelect
            control={form.control}
            name="channelId"
            id="ann-channel"
            options={channelOptions}
            placeholder={t("channelPlaceholder")}
            disabled={channels === null || sent}
            invalid={Boolean(errors.channelId)}
          />
          <FieldDescription>{sent ? t("channelFixed") : channels === null ? t("botOffline") : t("channelHelp")}</FieldDescription>
          {fieldError("channelId", "channelId")}
        </Field>

        <Field>
          <FieldLabel htmlFor="ann-role">{t("role")}</FieldLabel>
          <FormSelect control={form.control} name="pingRoleId" id="ann-role" options={roleOptions} placeholder={t("noRole")} disabled={roles === null} />
          <FieldDescription>{t("roleHelp")}</FieldDescription>
        </Field>

        <Field data-invalid={Boolean(errors.content) || undefined}>
          <FieldLabel htmlFor="ann-content">{t("content")}</FieldLabel>
          <Textarea id="ann-content" rows={4} maxLength={MAX_CONTENT} aria-invalid={Boolean(errors.content) || undefined} {...form.register("content")} />
          <FieldDescription>{t("contentHelp", { count: content.length, max: MAX_CONTENT })}</FieldDescription>
          {fieldError("content", "content")}
        </Field>

        <Field orientation="horizontal">
          <Controller
            control={form.control}
            name="embedEnabled"
            render={({ field }) => <Switch id="ann-embed" checked={field.value} onCheckedChange={field.onChange} />}
          />
          <FieldLabel htmlFor="ann-embed">{t("embed")}</FieldLabel>
        </Field>

        {embedEnabled && (
          <>
            <Field>
              <FieldLabel htmlFor="ann-embed-title">{t("embedTitle")}</FieldLabel>
              <Input id="ann-embed-title" maxLength={MAX_EMBED_TITLE} {...form.register("embedTitle")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ann-embed-description">{t("embedDescription")}</FieldLabel>
              <Textarea id="ann-embed-description" rows={5} maxLength={MAX_EMBED_DESCRIPTION} {...form.register("embedDescription")} />
              <FieldDescription>{t("embedDescriptionHelp", { count: embedDescription.length, max: MAX_EMBED_DESCRIPTION })}</FieldDescription>
            </Field>
            <Field data-invalid={Boolean(errors.embedImageUrl) || undefined}>
              <FieldLabel htmlFor="ann-embed-image">{t("image")}</FieldLabel>
              <Input
                id="ann-embed-image"
                type="url"
                inputMode="url"
                autoComplete="off"
                maxLength={MAX_IMAGE_URL}
                placeholder="https://"
                aria-invalid={Boolean(errors.embedImageUrl) || undefined}
                {...form.register("embedImageUrl")}
              />
              <FieldDescription>{t("imageHelp")}</FieldDescription>
              {fieldError("embedImageUrl", "embedImageUrl")}
            </Field>
            <Field>
              <FieldLabel htmlFor="ann-color">{t("color")}</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  id="ann-color"
                  type="color"
                  value={colorToHexString(embedColor)}
                  onChange={(e) => {
                    const next = hexStringToColor(e.target.value);
                    if (next !== undefined) form.setValue("embedColor", next, { shouldDirty: true });
                  }}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                />
                <span className="text-sm text-muted-foreground tabular-nums">{colorToHexString(embedColor)}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("embedColor", DEFAULT_ANNOUNCEMENT_COLOR, { shouldDirty: true })}>
                  {t("colorReset")}
                </Button>
              </div>
            </Field>
          </>
        )}

        {!sent && (
          <>
            <Field>
              <FieldLabel htmlFor="ann-mode">{t("when")}</FieldLabel>
              <FormSelect control={form.control} name="mode" id="ann-mode" options={modeOptions} placeholder={t("when")} />
            </Field>
            {mode === "schedule" && (
              <Field data-invalid={Boolean(errors.scheduledLocal) || undefined}>
                <FieldLabel htmlFor="ann-time">{t("time")}</FieldLabel>
                <FormDateTime control={form.control} name="scheduledLocal" id="ann-time" min={minLocal} invalid={Boolean(errors.scheduledLocal)} />
                <FieldDescription>{t("timeHelp")}</FieldDescription>
                {fieldError("scheduledLocal", "scheduledFor")}
              </Field>
            )}
          </>
        )}
      </FieldGroup>

      <div className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
        <AnnouncementPreview
          content={content}
          embedEnabled={embedEnabled}
          embedTitle={embedTitle}
          embedDescription={embedDescription}
          embedColor={embedColor}
          hasImage={embedImageUrl.trim() !== ""}
          roleName={roleName}
        />
        <p className="text-xs text-muted-foreground">{t("previewNote")}</p>
      </div>
      </div>

      {/* Outside the grid: the sticky preview column may only move inside its own area, never over the buttons. */}
      <DialogFooter className="sticky -bottom-4 z-10 bg-muted">
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
