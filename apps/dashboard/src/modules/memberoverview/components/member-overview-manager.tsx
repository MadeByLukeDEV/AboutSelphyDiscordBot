"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { memberOverviewInput, OVERVIEW_LANGUAGES, type MemberOverviewInput } from "@aboutselphy/shared/memberoverview";
import { ColorPicker } from "@/components/form/color-picker";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { SaveRow } from "@/components/page/save-row";
import { Section } from "@/components/page/section";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { postMemberOverviewAction, saveMemberOverviewAction } from "../actions";
import type { MemberOverviewPageData } from "../schema";

/** Where and in which language the member overview is posted in Discord, and the post button. */
export function MemberOverviewManager({ data, channels }: { data: MemberOverviewPageData; channels: GuildChannel[] | null }) {
  const t = useTranslations("MemberOverview");
  const te = useTranslations("MemberOverview.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<MemberOverviewInput>({ resolver: zodResolver(memberOverviewInput), defaultValues: data.settings });
  const { isDirty } = form.formState;

  const channelOptions: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (data.settings.channelId && !channelOptions.some((o) => o.value === data.settings.channelId)) channelOptions.push({ value: data.settings.channelId, label: data.settings.channelId });
  const languageOptions: SelectOption[] = OVERVIEW_LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }));

  const save = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        const result = await saveMemberOverviewAction(values);
        if (result.ok) {
          toast.success(t("form.saved"));
          form.reset(result.settings);
          router.refresh();
        } else {
          toast.error(te(result.error));
        }
      }),
    () => toast.error(te("invalid")),
  );

  function post() {
    startTransition(async () => {
      const result = await postMemberOverviewAction();
      if (result.ok) {
        toast.success(t("posted", { count: result.messages }));
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <form onSubmit={(e) => void save(e)} className="flex flex-col gap-fluid" noValidate>
      <Section title={t("form.title")} description={t("form.intro")}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="mo-channel">{t("form.channel")}</FieldLabel>
            <FormSelect control={form.control} name="channelId" id="mo-channel" options={channelOptions} placeholder={t("noChannel")} disabled={channels === null} />
            <FieldDescription>{channels === null ? t("form.botOffline") : t("form.channelHelp")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="mo-language">{t("form.language")}</FieldLabel>
            <FormSelect control={form.control} name="language" id="mo-language" options={languageOptions} placeholder={t("languages.en")} />
            <FieldDescription>{t("form.languageHelp")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="mo-color">{t("form.color")}</FieldLabel>
            <Controller control={form.control} name="color" render={({ field }) => <ColorPicker id="mo-color" value={field.value} onChange={field.onChange} />} />
          </Field>
        </FieldGroup>
      </Section>
      <SaveRow dirty={isDirty} pending={pending} label={t("form.save")} savingLabel={t("form.saving")}>
        <Button type="button" variant="outline" disabled={pending || isDirty || !data.settings.channelId} onClick={post}>
          <Send aria-hidden />
          {data.postedAt ? t("update") : t("post")}
        </Button>
        <p className="text-sm text-muted-foreground">{isDirty ? t("saveFirst") : data.postedAt ? t("lastPosted", { when: format.relativeTime(new Date(data.postedAt)) }) : t("neverPosted")}</p>
      </SaveRow>
      <p className="text-sm text-muted-foreground">
        <a href="/features" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
          {t("preview")}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </p>
    </form>
  );
}
