"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { MAX_CARD_IMAGE_BYTES } from "@aboutselphy/shared/image-info";
import { CARD_MODES, MAX_CARD_SUBTITLE, MAX_CARD_TITLE, type WelcomeSettings } from "@aboutselphy/shared/welcome";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { removeCardImageAction, uploadCardImageAction } from "../actions";
import type { CardImageView } from "../schema";

/**
 * The optional welcome card: a picture the bot draws for each new member (avatar, name, number)
 * on the admin's own image. The picture upload takes effect at once; the other settings with Save.
 * The preview is drawn by the bot from the SAVED settings, so it is refreshed after a save or an upload.
 */
export function CardSettings({ form, cardImage, version }: { form: UseFormReturn<WelcomeSettings>; cardImage: CardImageView | null; version: number }) {
  const t = useTranslations("Welcome.card");
  const te = useTranslations("Welcome.card.errors");
  const format = useFormatter();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  // Changing this reloads the preview picture.
  const [bump, setPreviewKey] = useState(0);
  const previewKey = bump + version * 1000;
  const [previewFailed, setPreviewFailed] = useState(false);
  const enabled = useWatch({ control: form.control, name: "welcomeCardEnabled" });
  const { errors } = form.formState;

  const modeOptions: SelectOption[] = CARD_MODES.map((m) => ({ value: m, label: t(`modes.${m}`) }));

  function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_CARD_IMAGE_BYTES) return void toast.error(te("size"));
    const body = new FormData();
    body.set("image", file);
    startTransition(async () => {
      const result = await uploadCardImageAction(body);
      if (input.current) input.current.value = "";
      if (result.ok) {
        toast.success(t("uploaded"));
        setPreviewKey((k) => k + 1);
        setPreviewFailed(false);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCardImageAction();
      if (result.ok) {
        toast.success(t("removed"));
        setPreviewKey((k) => k + 1);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field orientation="horizontal">
        <Controller control={form.control} name="welcomeCardEnabled" render={({ field }) => <Switch id="w-card" checked={field.value} onCheckedChange={field.onChange} aria-describedby="w-card-help" />} />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="w-card">{t("enabled")}</FieldLabel>
          <FieldDescription id="w-card-help">{t("enabledHelp")}</FieldDescription>
        </div>
      </Field>

      {enabled && (
        <>
          <Field data-invalid={Boolean(errors.welcomeCardTitle) || undefined}>
            <FieldLabel htmlFor="w-card-title">{t("title")}</FieldLabel>
            <Input id="w-card-title" maxLength={MAX_CARD_TITLE} aria-invalid={Boolean(errors.welcomeCardTitle) || undefined} {...form.register("welcomeCardTitle")} />
            {errors.welcomeCardTitle && <FieldError>{te("invalid")}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="w-card-subtitle">{t("subtitle")}</FieldLabel>
            <Input id="w-card-subtitle" maxLength={MAX_CARD_SUBTITLE} {...form.register("welcomeCardSubtitle")} />
            <FieldDescription>{t("subtitleHelp")}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="w-card-image">{t("image")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              {cardImage && (
                // eslint-disable-next-line @next/next/no-img-element -- the admin's own picture, served by this site (admin only)
                <img key={previewKey} src={`/api/welcome/card-image?v=${previewKey}`} alt="" className="h-16 max-w-[8rem] rounded-lg border object-contain" />
              )}
              <input
                ref={input}
                id="w-card-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={pending}
                onChange={(e) => upload(e.target.files?.[0])}
                className="max-w-full text-sm file:mr-3 file:rounded-lg file:border file:bg-card file:px-3 file:py-1.5 file:text-sm"
              />
              {cardImage && (
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}>
                  {t("remove")}
                </Button>
              )}
            </div>
            <FieldDescription>
              {cardImage
                ? t("current", { width: cardImage.width, height: cardImage.height, name: cardImage.uploadedByName, date: format.dateTime(new Date(cardImage.uploadedAt), { dateStyle: "medium" }) })
                : t("imageHelp")}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="w-card-mode">{t("mode")}</FieldLabel>
            <FormSelect control={form.control} name="welcomeCardMode" id="w-card-mode" options={modeOptions} placeholder={t("mode")} />
            <FieldDescription>{t("modeHelp")}</FieldDescription>
          </Field>

          <figure aria-label={t("preview")} className="flex flex-col gap-2">
            <figcaption className="text-xs font-medium text-muted-foreground">{t("preview")}</figcaption>
            {previewFailed ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">{t("previewFailed")}</p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- drawn by the bot, served by this site (admin only)
              <img key={previewKey} src={`/api/welcome/card-preview?v=${previewKey}`} alt={t("previewAlt")} onError={() => setPreviewFailed(true)} className="w-full max-w-[32rem] rounded-xl border" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setPreviewFailed(false); setPreviewKey((k) => k + 1); }}>
                {t("refresh")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("previewNote")}</p>
            </div>
          </figure>
        </>
      )}
    </div>
  );
}
