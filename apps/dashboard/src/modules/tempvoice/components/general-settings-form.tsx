"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveGlobalSettingsAction } from "../actions";
import { globalFormSchema, globalFromForm, globalToForm, type GlobalFormValues, type GlobalSettings } from "../schema";

/** The settings every lobby shares: the master switch and the blocked words. */
export function GeneralSettingsForm({
  initial,
  builtInCount,
  maxLobbies,
}: {
  initial: GlobalSettings;
  /** How many patterns the built-in list has. A number only: the list itself stays on the server. */
  builtInCount: number;
  maxLobbies: number;
}) {
  const t = useTranslations("TempVoice.general");
  const te = useTranslations("TempVoice.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<GlobalFormValues>({ resolver: zodResolver(globalFormSchema), defaultValues: globalToForm(initial) });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveGlobalSettingsAction(globalFromForm(values));
      if (result.ok) {
        toast.success(result.botNotified ? t("saved") : t("savedBotLater"));
        form.reset(globalToForm(result.settings));
        router.refresh(); // the live view needs the new on/off state
      } else {
        toast.error(te(result.error, { max: maxLobbies }));
      }
    }),
  );

  const toggle = (name: "enabled" | "useDefaultBlocklist" | "rememberSettings", label: string, help: string) => (
    <Field orientation="horizontal">
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => <Switch id={name} checked={field.value} onCheckedChange={field.onChange} aria-describedby={`${name}-help`} />}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <FieldDescription id={`${name}-help`}>{help}</FieldDescription>
      </div>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6" noValidate>
      <FieldGroup>
        {toggle("enabled", t("enabled"), t("enabledHelp"))}
        {toggle("useDefaultBlocklist", t("defaultBlocklist"), t("defaultBlocklistHelp", { count: builtInCount }))}
        {toggle("rememberSettings", t("remember"), t("rememberHelp"))}

        <Field data-invalid={Boolean(errors.blockedWordsText) || undefined}>
          <FieldLabel htmlFor="blockedWordsText">{t("blocked")}</FieldLabel>
          <Textarea id="blockedWordsText" rows={5} {...form.register("blockedWordsText")} />
          <FieldDescription>{t("blockedHelp")}</FieldDescription>
          {errors.blockedWordsText && <FieldError>{te("invalid")}</FieldError>}
        </Field>
      </FieldGroup>

      <div>
        <Button type="submit" disabled={pending || !isDirty}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
