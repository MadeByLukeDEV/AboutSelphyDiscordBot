"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { colorToHex, hexToColor } from "@aboutselphy/shared/twitch-template";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveYoutubeSettingsAction } from "../actions";
import { DEFAULT_COLOR, MAX_TEMPLATE_LENGTH, youtubeSettingsSchema, type YoutubeOverview, type YoutubeSettings } from "../schema";
import { ColorPicker } from "@/components/form/color-picker";

/** Status of the poller, the settings form with a preview, and the latest videos the bot has seen. */
export function YoutubeManager({
  overview,
  channels,
  roles,
}: {
  overview: YoutubeOverview;
  /** Text channels. null = the bot couldn't be reached, so the lists aren't available. */
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
}) {
  const t = useTranslations("Youtube");
  const te = useTranslations("Youtube.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { settings, lastCheckedAt, lastError, videos } = overview;

  const form = useForm<YoutubeSettings>({ resolver: zodResolver(youtubeSettingsSchema), defaultValues: settings });
  const { errors, isDirty } = form.formState;
  const [template, color, pingRoleId, announceShorts] = useWatch({ control: form.control, name: ["messageTemplate", "embedColor", "pingRoleId", "announceShorts"] });

  const channelOptions: SelectOption[] = [
    { value: "", label: t("form.noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (settings.channelId && !channelOptions.some((o) => o.value === settings.channelId)) channelOptions.push({ value: settings.channelId, label: settings.channelId });
  const roleOptions: SelectOption[] = [{ value: "", label: t("form.noRole") }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];
  if (settings.pingRoleId && !roleOptions.some((o) => o.value === settings.pingRoleId)) roleOptions.push({ value: settings.pingRoleId, label: settings.pingRoleId });
  const roleName = pingRoleId ? (roleOptions.find((o) => o.value === pingRoleId)?.label ?? null) : null;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveYoutubeSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  const sample = { title: t("preview.sampleTitle"), channel: t("preview.sampleChannel"), url: "https://www.youtube.com/watch?v=…" };
  const preview = template.replace(/\{(title|channel|url)\}/g, (_, k: "title" | "channel" | "url") => sample[k]);

  return (
    <div className="flex flex-col gap-fluid">
      {/* The poller */}
      <section aria-labelledby="yt-status" className="surface flex flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="yt-status" className="text-fluid-lg font-bold">
            {t("status.title")}
          </h2>
          <Badge variant={lastError ? "destructive" : lastCheckedAt ? "default" : "secondary"}>
            {lastError ? t("status.failing") : lastCheckedAt ? t("status.working") : t("status.waiting")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {lastCheckedAt ? t("status.checked", { time: format.dateTime(new Date(lastCheckedAt), { dateStyle: "medium", timeStyle: "short" }) }) : t("status.never")}
        </p>
        {lastError && <p className="text-sm text-destructive">{t(`status.errors.${lastError === "quota" || lastError === "keyRejected" || lastError === "notFound" ? lastError : "failed"}`)}</p>}
      </section>

      {/* Settings */}
      <form onSubmit={onSubmit} className="surface flex flex-col gap-5 p-5" noValidate>
        <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
        <FieldGroup>
          <Field orientation="horizontal">
            <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="yt-enabled" checked={field.value} onCheckedChange={field.onChange} aria-describedby="yt-enabled-help" />} />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="yt-enabled">{t("form.enabled")}</FieldLabel>
              <FieldDescription id="yt-enabled-help">{t("form.enabledHelp")}</FieldDescription>
            </div>
          </Field>

          <Field data-invalid={Boolean(errors.channelId) || undefined}>
            <FieldLabel htmlFor="yt-channel">{t("form.channel")}</FieldLabel>
            <FormSelect control={form.control} name="channelId" id="yt-channel" options={channelOptions} placeholder={t("form.channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
            <FieldDescription>{channels === null ? t("form.botOffline") : t("form.channelHelp")}</FieldDescription>
            {errors.channelId && <FieldError>{te("needsChannel")}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="yt-role">{t("form.role")}</FieldLabel>
            <FormSelect control={form.control} name="pingRoleId" id="yt-role" options={roleOptions} placeholder={t("form.noRole")} disabled={roles === null} />
            <FieldDescription>{t("form.roleHelp")}</FieldDescription>
          </Field>

          <Field data-invalid={Boolean(errors.messageTemplate) || undefined}>
            <FieldLabel htmlFor="yt-template">{t("form.message")}</FieldLabel>
            <Textarea id="yt-template" rows={2} maxLength={MAX_TEMPLATE_LENGTH} aria-invalid={Boolean(errors.messageTemplate) || undefined} {...form.register("messageTemplate")} />
            <FieldDescription>{t("form.messageHelp")}</FieldDescription>
            {errors.messageTemplate && <FieldError>{te("invalid")}</FieldError>}
          </Field>

          <Field orientation="horizontal">
            <Controller control={form.control} name="announceShorts" render={({ field }) => <Switch id="yt-shorts" checked={field.value} onCheckedChange={field.onChange} aria-describedby="yt-shorts-help" />} />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="yt-shorts">{t("form.shorts")}</FieldLabel>
              <FieldDescription id="yt-shorts-help">{t("form.shortsHelp")}</FieldDescription>
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="yt-color">{t("form.color")}</FieldLabel>
            <div className="flex items-center gap-2">
              <ColorPicker id="yt-color" value={colorToHex(color)} onChange={(hex) => {
                  const next = hexToColor(hex);
                  if (next !== undefined) form.setValue("embedColor", next, { shouldDirty: true });
                }} />
              <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("embedColor", DEFAULT_COLOR, { shouldDirty: true })}>
                {t("form.colorReset")}
              </Button>
            </div>
          </Field>
        </FieldGroup>

        {/* Preview (plain text; the picture is YouTube's thumbnail, shown by Discord) */}
        <figure aria-label={t("preview.label")} className="flex flex-col gap-2">
          <figcaption className="text-xs font-medium text-muted-foreground">{t("preview.label")}</figcaption>
          <div className="flex gap-3 rounded-xl bg-[#313338] p-3 text-[#dbdee1]">
            <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              AS
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-sm font-semibold text-white">{t("preview.botName")}</p>
              <p className="text-sm break-words whitespace-pre-wrap">
                {roleName && <span className="mr-1 rounded bg-[#5865f2]/30 px-1 font-medium text-[#c9cdfb]">@{roleName}</span>}
                {preview}
              </p>
              <div className="flex max-w-[26rem] overflow-hidden rounded bg-[#2b2d31]">
                <span className="w-1 shrink-0" style={{ backgroundColor: colorToHex(color) }} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                  <p className="text-xs font-semibold text-white">{t("preview.sampleChannel")}</p>
                  <p className="text-sm font-semibold text-[#00a8fc]">{t("preview.sampleTitle")}</p>
                  <div aria-hidden className="mt-1 flex aspect-video w-full items-center justify-center rounded bg-[#1e1f22] text-xs text-[#949ba4]">
                    {t("preview.thumbnail")}
                  </div>
                </div>
              </div>
              {!announceShorts && <p className="text-xs text-[#949ba4]">{t("preview.shortsNote")}</p>}
            </div>
          </div>
        </figure>

        <div>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>

      {/* What the bot has seen */}
      <section aria-labelledby="yt-videos" className="flex flex-col gap-3">
        <h2 id="yt-videos" className="text-fluid-lg font-bold">
          {t("videos.title")}
        </h2>
        {videos.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-8 text-center">
            <h3 className="font-semibold">{t("videos.empty.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("videos.empty.body")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {videos.map((v) => (
              <li key={v.videoId} className="surface flex overflow-hidden">
                <span className={cn("w-1.5 shrink-0", v.announced ? "bg-[#ff0000]" : "bg-muted-foreground/40")} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-[12rem] flex-1">
                    <p className="truncate font-medium">{v.title}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">{format.dateTime(new Date(v.publishedAt), { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.isShort && <Badge variant="secondary">{t("videos.short")}</Badge>}
                    <Badge variant={v.announced ? "default" : "secondary"}>{v.announced ? t("videos.announced") : t("videos.notAnnounced")}</Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
