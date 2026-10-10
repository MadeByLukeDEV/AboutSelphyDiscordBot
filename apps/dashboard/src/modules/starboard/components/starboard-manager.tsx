"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { MAX_THRESHOLD, MIN_THRESHOLD, starboardSettingsSchema, type StarboardSettings } from "@aboutselphy/shared/starboard";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveStarboardAction } from "../actions";
import type { StarboardRow } from "../schema";

/** The starboard settings and the most starred messages. State flows in as props; saving calls router.refresh(). */
export function StarboardManager({ initial, posts, channels }: { initial: StarboardSettings; posts: StarboardRow[]; channels: GuildChannel[] | null }) {
  const t = useTranslations("Starboard");
  const te = useTranslations("Starboard.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<StarboardSettings>({ resolver: zodResolver(starboardSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const channelOptions: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (initial.channelId && !channelOptions.some((o) => o.value === initial.channelId)) channelOptions.push({ value: initial.channelId, label: initial.channelId });
  const channelName = (id: string) => (channels?.find((c) => c.id === id) ? `#${channels.find((c) => c.id === id)!.name}` : id);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveStarboardAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  return (
    <div className="flex flex-col gap-fluid">
      <form onSubmit={onSubmit} className="surface flex flex-col gap-5 p-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
        </div>
        <FieldGroup>
          <Field orientation="horizontal">
            <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="sb-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldLabel htmlFor="sb-enabled">{t("form.enabled")}</FieldLabel>
          </Field>
          <Field data-invalid={Boolean(errors.channelId) || undefined}>
            <FieldLabel htmlFor="sb-channel">{t("form.channel")}</FieldLabel>
            <FormSelect control={form.control} name="channelId" id="sb-channel" options={channelOptions} placeholder={t("form.channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
            <FieldDescription>{channels === null ? t("form.botOffline") : t("form.channelHelp")}</FieldDescription>
            {errors.channelId && <FieldError>{te("needsChannel")}</FieldError>}
          </Field>
          <div className="flex flex-wrap gap-4">
            <Field data-invalid={Boolean(errors.emoji) || undefined}>
              <FieldLabel htmlFor="sb-emoji">{t("form.emoji")}</FieldLabel>
              <Input id="sb-emoji" className="max-w-[6rem] text-center text-lg" maxLength={16} aria-invalid={Boolean(errors.emoji) || undefined} {...form.register("emoji")} />
              <FieldDescription>{t("form.emojiHelp")}</FieldDescription>
              {errors.emoji && <FieldError>{te("badEmoji")}</FieldError>}
            </Field>
            <Field data-invalid={Boolean(errors.threshold) || undefined}>
              <FieldLabel htmlFor="sb-threshold">{t("form.threshold")}</FieldLabel>
              <Input id="sb-threshold" type="number" inputMode="numeric" min={MIN_THRESHOLD} max={MAX_THRESHOLD} className="max-w-[7rem]" {...form.register("threshold", { valueAsNumber: true })} />
              <FieldDescription>{t("form.thresholdHelp", { min: MIN_THRESHOLD, max: MAX_THRESHOLD })}</FieldDescription>
              {errors.threshold && <FieldError>{te("badThreshold", { min: MIN_THRESHOLD, max: MAX_THRESHOLD })}</FieldError>}
            </Field>
          </div>
          <Field orientation="horizontal">
            <Controller control={form.control} name="allowSelf" render={({ field }) => <Switch id="sb-self" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldLabel htmlFor="sb-self">{t("form.allowSelf")}</FieldLabel>
          </Field>
        </FieldGroup>
        <div>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>

      <section aria-labelledby="sb-list" className="flex flex-col gap-3">
        <h2 id="sb-list" className="text-fluid-lg font-bold">
          {t("list.title")}
        </h2>
        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
            <h3 className="font-semibold">{t("list.empty.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("list.empty.body")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((p) => (
              <li key={p.messageId} className="surface flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-12 shrink-0 text-center text-fluid-lg font-bold tabular-nums">{p.stars}</span>
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.authorName}</span>
                    <Badge variant={p.onBoard ? "default" : "secondary"}>{p.onBoard ? t("list.onBoard") : t("list.belowThreshold")}</Badge>
                  </div>
                  <p className="break-words text-sm text-muted-foreground">{p.excerpt || t("list.noText")}</p>
                  <p className="text-xs text-muted-foreground">
                    {channelName(p.channelId)} · {format.dateTime(new Date(p.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <a href={p.jumpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline">
                  {t("list.open")}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
