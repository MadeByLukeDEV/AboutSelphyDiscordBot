"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveLobbyAction } from "../actions";
import { DEFAULT_LOBBY_FORM, lobbyFormSchema, type LobbyFormValues, type LobbyView } from "../schema";

/** The form inside the add/edit dialog. `lobby` is the one being edited, or null for a new one. */
export function LobbyForm({
  lobby,
  channels,
  takenChannelIds,
  maxLobbies,
  onDone,
}: {
  lobby: LobbyView | null;
  /** null = the bot couldn't be reached, so the lists aren't available. */
  channels: GuildChannel[] | null;
  takenChannelIds: ReadonlySet<string>;
  maxLobbies: number;
  onDone: () => void;
}) {
  const t = useTranslations("TempVoice.lobbies");
  const td = useTranslations("TempVoice.lobbies.dialog");
  const te = useTranslations("TempVoice.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<LobbyFormValues>({
    resolver: zodResolver(lobbyFormSchema),
    defaultValues: lobby ? { ...lobby } : DEFAULT_LOBBY_FORM,
  });
  const { errors } = form.formState;
  const editing = lobby !== null;

  // The bot lists channels in Discord's own order. A voice channel is offered once:
  // the ones that are already lobbies are left out. The closed field shows
  // "Name (Category)" because names repeat across categories; the open list groups
  // them under the category.
  const voiceOptions: SelectOption[] = (channels ?? [])
    .filter((c) => c.kind === "voice" && !takenChannelIds.has(c.id))
    .map((c) => ({ value: c.id, label: c.parent ? `${c.name} (${c.parent})` : c.name, text: c.name, group: c.parent ?? undefined }));
  const categoryOptions: SelectOption[] = [
    { value: "", label: td("noCategory") },
    ...(channels ?? []).filter((c) => c.kind === "category").map((c) => ({ value: c.id, label: c.name })),
  ];
  // A saved category is always offered, even with the bot offline or the category deleted.
  if (lobby?.categoryId && !categoryOptions.some((o) => o.value === lobby.categoryId)) {
    categoryOptions.push({ value: lobby.categoryId, label: lobby.categoryId });
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!editing && !values.channelId) {
      form.setError("channelId", { message: "required" });
      return;
    }
    startTransition(async () => {
      const result = await saveLobbyAction(editing ? { id: lobby.id, ...values } : values);
      if (result.ok) {
        toast.success(result.botNotified ? t(editing ? "saved" : "added") : t("savedBotLater"));
        onDone();
      } else {
        toast.error(te(result.error, { max: maxLobbies }));
      }
    });
  });

  const toggle = (name: "allowVideoByDefault" | "allowSoundboardByDefault" | "enabled", label: string, help?: string) => (
    <Field orientation="horizontal">
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Switch id={`lobby-${name}`} checked={field.value} onCheckedChange={field.onChange} aria-describedby={help ? `lobby-${name}-help` : undefined} />
        )}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={`lobby-${name}`}>{label}</FieldLabel>
        {help && <FieldDescription id={`lobby-${name}-help`}>{help}</FieldDescription>}
      </div>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="lobby-channelId">{td("channel")}</FieldLabel>
          {editing ? (
            <>
              <Input id="lobby-channelId" readOnly value={channels?.find((c) => c.id === lobby.channelId)?.name ?? lobby.channelId} />
              <FieldDescription>{td("channelFixed")}</FieldDescription>
            </>
          ) : (
            <>
              <FormSelect
                control={form.control}
                name="channelId"
                id="lobby-channelId"
                options={voiceOptions}
                placeholder={td("channelPlaceholder")}
                disabled={channels === null || voiceOptions.length === 0}
                invalid={Boolean(errors.channelId)}
              />
              <FieldDescription>{channels !== null && voiceOptions.length === 0 ? td("noChannelsLeft") : td("channelHelp")}</FieldDescription>
              {errors.channelId && <FieldError>{te("lobbyNotFound")}</FieldError>}
            </>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="lobby-categoryId">{td("category")}</FieldLabel>
          <FormSelect
            control={form.control}
            name="categoryId"
            id="lobby-categoryId"
            options={categoryOptions}
            placeholder={td("categoryPlaceholder")}
            disabled={channels === null}
          />
          <FieldDescription>{td("categoryHelp")}</FieldDescription>
        </Field>

        <Field data-invalid={Boolean(errors.nameTemplate) || undefined}>
          <FieldLabel htmlFor="lobby-nameTemplate">{td("nameTemplate")}</FieldLabel>
          <Input id="lobby-nameTemplate" maxLength={100} aria-invalid={Boolean(errors.nameTemplate) || undefined} {...form.register("nameTemplate")} />
          <FieldDescription>{td("nameTemplateHelp")}</FieldDescription>
          {errors.nameTemplate && <FieldError>{te("invalid")}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.defaultUserLimit) || undefined}>
          <FieldLabel htmlFor="lobby-defaultUserLimit">{td("limit")}</FieldLabel>
          <Input
            id="lobby-defaultUserLimit"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            className="max-w-[8rem]"
            aria-invalid={Boolean(errors.defaultUserLimit) || undefined}
            {...form.register("defaultUserLimit", { valueAsNumber: true })}
          />
          <FieldDescription>{td("limitHelp")}</FieldDescription>
          {errors.defaultUserLimit && <FieldError>{te("invalid")}</FieldError>}
        </Field>

        {toggle("allowVideoByDefault", td("video"))}
        {toggle("allowSoundboardByDefault", td("soundboard"), td("defaultsHelp"))}
        {toggle("enabled", td("enabled"), td("enabledHelp"))}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{td("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? td("saving") : td("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
