"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { MAX_GUIDE_DESCRIPTION, MAX_GUIDE_NOTES, MAX_GUIDE_TITLE, modGuideInput, type ModGuideInput } from "@aboutselphy/shared/modguide";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { postModGuideAction, saveModGuideAction } from "../actions";
import type { ModGuidePageData } from "../schema";
import { ColorPicker } from "@/components/form/color-picker";
import { EmoteInsert } from "@/components/form/emote-insert";

/** The moderators' guide: the text around it, a look at the commands it lists, and the post button. */
export function ModGuideManager({ data, channels }: { data: ModGuidePageData; channels: GuildChannel[] | null }) {
  const t = useTranslations("ModGuide");
  const te = useTranslations("ModGuide.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ModGuideInput>({ resolver: zodResolver(modGuideInput), defaultValues: data.settings });
  const { errors, isDirty } = form.formState;
  const preview = useWatch({ control: form.control });

  const channelOptions: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (data.settings.channelId && !channelOptions.some((o) => o.value === data.settings.channelId)) channelOptions.push({ value: data.settings.channelId, label: data.settings.channelId });

  const save = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveModGuideAction(values);
      if (result.ok) {
        toast.success(t("form.saved"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  function post() {
    startTransition(async () => {
      const result = await postModGuideAction();
      if (result.ok) {
        toast.success(t("posted", { count: result.messages }));
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  const color = /^#[0-9a-fA-F]{6}$/.test(preview.color ?? "") ? preview.color : "#00FFA8";
  const hasImage = (preview.imageUrl ?? "").startsWith("https://");

  return (
    <div className="grid gap-fluid xl:grid-cols-2">
      <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-5 p-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
        </div>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.channelId) || undefined}>
            <FieldLabel htmlFor="mg-channel">{t("form.channel")}</FieldLabel>
            <FormSelect control={form.control} name="channelId" id="mg-channel" options={channelOptions} placeholder={t("noChannel")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
            <FieldDescription>{t("form.channelHelp")}</FieldDescription>
          </Field>
          <Field data-invalid={Boolean(errors.title) || undefined}>
            <FieldLabel htmlFor="mg-title">{t("form.heading")}</FieldLabel>
            <Input id="mg-title" maxLength={MAX_GUIDE_TITLE} aria-invalid={Boolean(errors.title) || undefined} {...form.register("title")} />
            {errors.title && <FieldError>{te("invalid")}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.description) || undefined}>
            <FieldLabel htmlFor="mg-description">{t("form.description")}</FieldLabel>
            <Textarea id="mg-description" rows={4} maxLength={MAX_GUIDE_DESCRIPTION} {...form.register("description")} />
<EmoteInsert targetId="mg-description" />
            <FieldDescription>{t("form.descriptionHelp")}</FieldDescription>
          </Field>
          <Field data-invalid={Boolean(errors.imageUrl) || undefined}>
            <FieldLabel htmlFor="mg-image">{t("form.image")}</FieldLabel>
            <Input id="mg-image" inputMode="url" placeholder="https://" aria-invalid={Boolean(errors.imageUrl) || undefined} {...form.register("imageUrl")} />
            <FieldDescription>{t("form.imageHelp")}</FieldDescription>
            {errors.imageUrl && <FieldError>{te("badImage")}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.color) || undefined}>
            <FieldLabel htmlFor="mg-color">{t("form.color")}</FieldLabel>
            <div className="flex items-center gap-3">
              <ColorPicker value={color} onChange={(hex) => form.setValue("color", hex, { shouldDirty: true, shouldValidate: true })} />
              <Input id="mg-color" className="max-w-[9rem]" maxLength={7} aria-invalid={Boolean(errors.color) || undefined} {...form.register("color")} />
            </div>
            {errors.color && <FieldError>{te("badColor")}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors.notes) || undefined}>
            <FieldLabel htmlFor="mg-notes">{t("form.notes")}</FieldLabel>
            <Textarea id="mg-notes" rows={4} maxLength={MAX_GUIDE_NOTES} {...form.register("notes")} />
<EmoteInsert targetId="mg-notes" />
            <FieldDescription>{t("form.notesHelp")}</FieldDescription>
          </Field>
        </FieldGroup>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
          <Button type="button" variant="outline" disabled={pending || isDirty || !data.settings.channelId} onClick={post}>
            <Send aria-hidden />
            {data.postedAt ? t("update") : t("post")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isDirty ? t("saveFirst") : data.postedAt ? t("lastPosted", { when: format.relativeTime(new Date(data.postedAt)) }) : t("neverPosted")}
          </p>
        </div>
      </form>

      <section aria-labelledby="mg-preview" className="surface flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 id="mg-preview" className="text-fluid-lg font-bold">
            {t("preview.title")}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("preview.intro")}</p>
        </div>
        {/* The picture is only a box: the dashboard never loads an address staff typed. */}
        <article className="overflow-hidden rounded-xl border bg-card" style={{ borderLeft: `0.25rem solid ${color}` }}>
          {hasImage && <div className="flex aspect-[3/1] items-center justify-center bg-muted text-xs text-muted-foreground">{t("preview.cover")}</div>}
          <div className="flex flex-col gap-1 p-3">
            <h3 className="font-semibold break-words">{preview.title || t("preview.untitled")}</h3>
            {preview.description && <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">{preview.description}</p>}
          </div>
        </article>
        {data.preview === null ? (
          <p className="text-sm text-muted-foreground">{t("preview.botOffline")}</p>
        ) : data.preview.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("preview.none")}</p>
        ) : (
          data.preview.categories.map((cat) => (
            <article key={cat.title} className="rounded-xl border bg-card p-3" style={{ borderLeft: `0.25rem solid ${color}` }}>
              <h3 className="mb-2 font-semibold">{cat.title}</h3>
              <ul className="flex flex-col gap-2">
                {cat.lines.map((line) => {
                  const [usage = "", ...rest] = line.split("\n");
                  return (
                    <li key={usage} className="text-sm">
                      <code className="font-semibold break-words">{usage.replaceAll("*", "").replaceAll("`", "")}</code>
                      <div className="text-muted-foreground">{rest.join(" ").replaceAll("\\", "")}</div>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))
        )}
        {(preview.notes ?? "") && (
          <article className="rounded-xl border bg-card p-3" style={{ borderLeft: `0.25rem solid ${color}` }}>
            <h3 className="mb-1 font-semibold">{t("preview.notesTitle")}</h3>
            <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">{preview.notes}</p>
          </article>
        )}
      </section>
    </div>
  );
}
