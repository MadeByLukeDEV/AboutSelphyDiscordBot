"use client";

import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildEmoji, GuildRole } from "@aboutselphy/shared";
import {
  customEmojiUrl,
  DEFAULT_PANEL_COLOR,
  parseEmoji,
  MAX_LABEL,
  MAX_REACTION_ROLES,
  MAX_PANEL_DESCRIPTION,
  MAX_PANEL_ROLES,
  MAX_PANEL_TITLE,
  MAX_ROLE_DESCRIPTION,
  PANEL_STYLES,
  rolePanelInput,
} from "@aboutselphy/shared/role-panel";
import { colorToHex, hexToColor } from "@aboutselphy/shared/twitch-template";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { savePanelAction } from "../actions";
import type { RolePanelView } from "../schema";
import { CreateRoleDialog } from "./create-role-dialog";
import { EmojiPicker } from "./emoji-picker";

type FormValues = {
  channelId: string;
  title: string;
  description: string;
  color: number;
  style: "buttons" | "menu" | "reactions";
  exclusive: boolean;
  roles: Array<{ roleId: string; label: string; emoji: string; description: string }>;
};

const EMPTY_ROLE = { roleId: "", label: "", emoji: "", description: "" };

/** The form inside the panel dialog. `panel` is the one being edited, or null for a new one. */
export function PanelForm({
  panel,
  channels,
  roles,
  emojis,
  onDone,
}: {
  panel: RolePanelView | null;
  /** Text channels. null = the bot couldn't be reached. */
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
  emojis: GuildEmoji[] | null;
  onDone: () => void;
}) {
  const t = useTranslations("Roles.panel");
  const te = useTranslations("Roles.errors");
  const [pending, startTransition] = useTransition();
  // Roles created from inside this dialog show up in the pickers at once, before the page refreshes.
  const [created, setCreated] = useState<GuildRole[]>([]);
  const posted = panel?.messageId != null;
  // Which role row has its server-emote grid open.
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);

  const form = useForm<FormValues>({
    defaultValues: panel
      ? { channelId: panel.channelId, title: panel.title, description: panel.description, color: panel.color, style: panel.style, exclusive: panel.exclusive, roles: panel.roles }
      : { channelId: "", title: "", description: "", color: DEFAULT_PANEL_COLOR, style: "buttons", exclusive: false, roles: [{ ...EMPTY_ROLE }] },
  });
  const { errors } = form.formState;
  const fields = useFieldArray({ control: form.control, name: "roles" });
  const [color, style, rows] = useWatch({ control: form.control, name: ["color", "style", "roles"] });

  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({
    value: c.id,
    label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`,
    text: `#${c.name}`,
    group: c.parent ?? undefined,
  }));
  if (panel && !channelOptions.some((o) => o.value === panel.channelId)) channelOptions.push({ value: panel.channelId, label: panel.channelId });

  // Only roles the bot may hand out are offered. A saved role that is gone or no longer allowed is still listed (by its id), so the
  // row never shows blank and the save is refused with a clear message.
  const allRoles = [...(roles ?? []), ...created.filter((c) => !roles?.some((r) => r.id === c.id))];
  const roleOptions: SelectOption[] = allRoles.filter((r) => r.assignable).map((r) => ({ value: r.id, label: r.name }));
  for (const row of panel?.roles ?? []) {
    if (!roleOptions.some((o) => o.value === row.roleId)) roleOptions.push({ value: row.roleId, label: allRoles.find((r) => r.id === row.roleId)?.name ?? row.roleId });
  }
  const styleOptions: SelectOption[] = PANEL_STYLES.map((s) => ({ value: s, label: t(`styles.${s}`) }));
  const nameOf = (id: string) => roleOptions.find((o) => o.value === id)?.label ?? "";

  const submit = (publish: boolean) =>
    form.handleSubmit((values) => {
      const payload = { ...(panel ? { id: panel.id } : {}), ...values, roles: values.roles.map((r) => ({ ...r, label: r.label.trim() || nameOf(r.roleId) })), publish };
      const checked = rolePanelInput.safeParse(payload);
      if (!checked.success) {
        form.clearErrors();
        for (const issue of checked.error.issues) {
          const [key, index, sub] = issue.path;
          if (key === "roles" && typeof index === "number" && typeof sub === "string") form.setError(`roles.${index}.${sub as "roleId"}`, { type: "custom", message: issue.message });
          else if (key === "roles") form.setError("roles", { type: "custom", message: issue.message });
          else if (key === "channelId" || key === "title") form.setError(key, { type: "custom", message: issue.message });
        }
        return;
      }
      startTransition(async () => {
        const result = await savePanelAction(checked.data);
        if (!result.ok) return void toast.error(te(result.error));
        if (result.postError) toast.error(te(result.postError));
        else toast.success(result.posted === "published" ? t("posted") : result.posted === "updated" ? t("updated") : t("savedDraft"));
        onDone();
      });
    });

  return (
    <form onSubmit={(e) => void submit(false)(e)} className="flex flex-col gap-6" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="rp-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="rp-channel" options={channelOptions} placeholder={t("channelPlaceholder")} disabled={channels === null || posted} invalid={Boolean(errors.channelId)} />
          <FieldDescription>{posted ? t("channelFixed") : channels === null ? t("botOffline") : t("channelHelp")}</FieldDescription>
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.title) || undefined}>
          <FieldLabel htmlFor="rp-title">{t("title")}</FieldLabel>
          <Input id="rp-title" maxLength={MAX_PANEL_TITLE} {...form.register("title")} />
          {errors.title && <FieldError>{te("needsText")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="rp-description">{t("description")}</FieldLabel>
          <Textarea id="rp-description" rows={3} maxLength={MAX_PANEL_DESCRIPTION} {...form.register("description")} />
        </Field>

        <Field>
          <FieldLabel htmlFor="rp-style">{t("style")}</FieldLabel>
          <FormSelect control={form.control} name="style" id="rp-style" options={styleOptions} placeholder={t("style")} />
          <FieldDescription>{style === "menu" ? t("menuHelp") : style === "reactions" ? t("reactionsHelp") : t("buttonsHelp")}</FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <Controller control={form.control} name="exclusive" render={({ field }) => <Switch id="rp-exclusive" checked={field.value} onCheckedChange={field.onChange} aria-describedby="rp-exclusive-help" />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="rp-exclusive">{t("exclusive")}</FieldLabel>
            <FieldDescription id="rp-exclusive-help">{t("exclusiveHelp")}</FieldDescription>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="rp-color">{t("color")}</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              id="rp-color"
              type="color"
              value={colorToHex(color)}
              onChange={(e) => {
                const next = hexToColor(e.target.value);
                if (next !== undefined) form.setValue("color", next, { shouldDirty: true });
              }}
              className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
            />
            <span className="text-sm text-muted-foreground tabular-nums">{colorToHex(color)}</span>
          </div>
        </Field>
      </FieldGroup>

      <section aria-labelledby="rp-roles" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 id="rp-roles" className="font-semibold">
              {t("roles")}
            </h3>
            <p className="text-sm text-muted-foreground">{t(style === "reactions" ? "rolesHelpReactions" : "rolesHelp", { max: style === "reactions" ? MAX_REACTION_ROLES : MAX_PANEL_ROLES })}</p>
          </div>
          <CreateRoleDialog trigger="small" onCreated={(role) => setCreated((c) => [...c, { id: role.id, name: role.name, color: role.color, assignable: true }])} />
        </div>
        {errors.roles && <FieldError>{te("rolesInvalid")}</FieldError>}

        <ul className="flex flex-col gap-3">
          {fields.fields.map((field, index) => {
            const rowError = errors.roles?.[index];
            return (
              <li key={field.id} className="flex flex-col gap-3 rounded-xl border p-3">
                <Field data-invalid={Boolean(rowError?.roleId) || undefined}>
                  <FieldLabel htmlFor={`rp-role-${index}`}>{t("role")}</FieldLabel>
                  <FormSelect
                    control={form.control}
                    name={`roles.${index}.roleId`}
                    id={`rp-role-${index}`}
                    options={roleOptions}
                    placeholder={t("rolePlaceholder")}
                    disabled={roles === null}
                    invalid={Boolean(rowError?.roleId)}
                  />
                  {rowError?.roleId && <FieldError>{te(rowError.roleId.message === "duplicate" ? "duplicateRole" : "roleNotFound")}</FieldError>}
                </Field>
                <Field data-invalid={Boolean(rowError?.label) || undefined}>
                  <FieldLabel htmlFor={`rp-label-${index}`}>{t("label")}</FieldLabel>
                  <Input id={`rp-label-${index}`} maxLength={MAX_LABEL} placeholder={nameOf(rows[index]?.roleId ?? "")} {...form.register(`roles.${index}.label`)} />
                </Field>
                <Field data-invalid={Boolean(rowError?.emoji) || undefined}>
                  <FieldLabel htmlFor={`rp-emoji-${index}`}>{t("emoji")}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <EmojiPreview value={rows[index]?.emoji ?? ""} />
                    <Input id={`rp-emoji-${index}`} maxLength={64} autoComplete="off" placeholder={t("emojiPlaceholder")} className="min-w-0 flex-1" {...form.register(`roles.${index}.emoji`)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(pickerOpen === index ? null : index)} aria-expanded={pickerOpen === index}>
                      {t("pickEmoji")}
                    </Button>
                    {(rows[index]?.emoji ?? "") !== "" && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue(`roles.${index}.emoji`, "", { shouldDirty: true, shouldValidate: true })}>
                        {t("clearEmoji")}
                      </Button>
                    )}
                  </div>
                  {rowError?.emoji && <FieldError>{te(rowError.emoji.message === "needsEmoji" ? "needsEmoji" : rowError.emoji.message === "duplicateEmoji" ? "duplicateEmoji" : "emojiInvalid")}</FieldError>}
                  {pickerOpen === index && (
                    <EmojiPicker
                      emojis={emojis}
                      onPick={(value) => {
                        form.setValue(`roles.${index}.emoji`, value, { shouldDirty: true, shouldValidate: true });
                        setPickerOpen(null);
                      }}
                    />
                  )}
                </Field>
                {style === "menu" && (
                  <Field>
                    <FieldLabel htmlFor={`rp-rdesc-${index}`}>{t("roleDescription")}</FieldLabel>
                    <Input id={`rp-rdesc-${index}`} maxLength={MAX_ROLE_DESCRIPTION} {...form.register(`roles.${index}.description`)} />
                  </Field>
                )}
                <div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => fields.remove(index)} disabled={fields.fields.length <= 1}>
                    <Trash2 aria-hidden />
                    {t("removeRole")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => fields.append({ ...EMPTY_ROLE })} disabled={fields.fields.length >= (style === "reactions" ? MAX_REACTION_ROLES : MAX_PANEL_ROLES)}>
            {t("addRole")}
          </Button>
        </div>
      </section>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="button" variant="outline" disabled={pending} onClick={() => void submit(false)()}>
          {posted ? t("saveUpdate") : t("saveDraft")}
        </Button>
        {!posted && (
          <Button type="button" disabled={pending} onClick={() => void submit(true)()}>
            {pending ? t("saving") : t("savePost")}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

/** The emoji of a role row: the emote's picture for a server emote, the character itself for unicode. */
function EmojiPreview({ value }: { value: string }) {
  const parsed = parseEmoji(value);
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg border text-lg">
      {parsed?.kind === "custom" ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small emote from Discord's CDN (allowed by the CSP)
        <img src={customEmojiUrl(parsed.id, parsed.animated, 32)} alt="" className="size-6" />
      ) : (
        (parsed?.name ?? "")
      )}
    </span>
  );
}
