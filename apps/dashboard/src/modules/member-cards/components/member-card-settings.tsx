"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { MAX_CARD_IMAGE_BYTES } from "@aboutselphy/shared/image-info";
import type { MemberCardKind } from "@aboutselphy/shared/member-card";
import { CARD_MODES, MAX_CARD_SUBTITLE, MAX_CARD_TITLE } from "@aboutselphy/shared/welcome";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { removeMemberCardImageAction, uploadMemberCardImageAction } from "../actions";
import type { CardImageView } from "../schema";

type CardFields = { cardEnabled: boolean; cardMode: "background" | "sticker"; cardTitle: string; cardSubtitle?: string };

/**
 * The optional picture the bot draws for a birthday or a reminder: the member's avatar and name on
 * the admin's own image, like the welcome card. The upload takes effect at once; the other settings
 * with the form's Save. The preview is drawn by the bot from the SAVED settings.
 */
export function MemberCardSettings<T extends CardFields>({ kind, form, cardImage, withSubtitle }: { kind: MemberCardKind; form: UseFormReturn<T>; cardImage: CardImageView | null; withSubtitle: boolean }) {
  const t = useTranslations("MemberCards");
  const te = useTranslations("MemberCards.errors");
  const format = useFormatter();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [previewKey, setPreviewKey] = useState(0);
  const [previewFailed, setPreviewFailed] = useState(false);
  // The form is typed by its caller; these four fields exist on every form that uses this component.
  const f = form as unknown as UseFormReturn<CardFields>;
  const enabled = useWatch({ control: f.control, name: "cardEnabled" });
  const { errors } = f.formState;
  const id = `mc-${kind}`;

  const modeOptions: SelectOption[] = CARD_MODES.map((m) => ({ value: m, label: t(`modes.${m}`) }));

  function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_CARD_IMAGE_BYTES) return void toast.error(te("size"));
    const body = new FormData();
    body.set("image", file);
    startTransition(async () => {
      const result = await uploadMemberCardImageAction(kind, body);
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
      const result = await removeMemberCardImageAction(kind);
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
        <Controller control={f.control} name="cardEnabled" render={({ field }) => <Switch id={`${id}-on`} checked={field.value} onCheckedChange={field.onChange} aria-describedby={`${id}-on-help`} />} />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${id}-on`}>{t(`kinds.${kind}.enabled`)}</FieldLabel>
          <FieldDescription id={`${id}-on-help`}>{t(`kinds.${kind}.enabledHelp`)}</FieldDescription>
        </div>
      </Field>

      {enabled && (
        <>
          <Field data-invalid={Boolean(errors.cardTitle) || undefined}>
            <FieldLabel htmlFor={`${id}-title`}>{t("title")}</FieldLabel>
            <Input id={`${id}-title`} maxLength={MAX_CARD_TITLE} aria-invalid={Boolean(errors.cardTitle) || undefined} {...f.register("cardTitle")} />
            {errors.cardTitle && <FieldError>{te("invalid")}</FieldError>}
          </Field>
          {withSubtitle && (
            <Field>
              <FieldLabel htmlFor={`${id}-subtitle`}>{t("subtitle")}</FieldLabel>
              <Input id={`${id}-subtitle`} maxLength={MAX_CARD_SUBTITLE} {...f.register("cardSubtitle")} />
              <FieldDescription>{t(`kinds.${kind}.subtitleHelp`)}</FieldDescription>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor={`${id}-image`}>{t("image")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              {cardImage && (
                // eslint-disable-next-line @next/next/no-img-element -- the admin's own picture, served by this site (admin only)
                <img key={previewKey} src={`/api/member-cards/${kind}/image?v=${previewKey}`} alt="" className="h-16 max-w-[8rem] rounded-lg border object-contain" />
              )}
              <input
                ref={input}
                id={`${id}-image`}
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
            <FieldLabel htmlFor={`${id}-mode`}>{t("mode")}</FieldLabel>
            <FormSelect control={f.control} name="cardMode" id={`${id}-mode`} options={modeOptions} placeholder={t("mode")} />
            <FieldDescription>{t("modeHelp")}</FieldDescription>
          </Field>

          <figure aria-label={t("preview")} className="flex flex-col gap-2">
            <figcaption className="text-xs font-medium text-muted-foreground">{t("preview")}</figcaption>
            {previewFailed ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">{t("previewFailed")}</p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- drawn by the bot, served by this site (admin only)
              <img key={previewKey} src={`/api/member-cards/${kind}/preview?v=${previewKey}`} alt={t(`kinds.${kind}.previewAlt`)} onError={() => setPreviewFailed(true)} className="w-full max-w-[32rem] rounded-xl border" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewFailed(false);
                  setPreviewKey((k) => k + 1);
                }}
              >
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
