"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { MAX_STAFF_ROLES, MAX_TICKET_CATEGORIES, ticketCategoriesSchema, type TicketCategoryInput } from "@aboutselphy/shared/tickets";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { MultiPicker } from "@/components/form/multi-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveTicketCategoriesAction } from "../actions";

type FormValues = { categories: TicketCategoryInput[] };

/** The ticket types: each is a button on the panel, with its own Discord category and staff roles if you want. Admins only. */
export function TicketCategories({ initial, channels, roles }: { initial: TicketCategoryInput[]; channels: GuildChannel[] | null; roles: GuildRole[] | null }) {
  const t = useTranslations("Tickets.categories");
  const te = useTranslations("Tickets.categories.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: { categories: initial } });
  const { errors, isDirty } = form.formState;
  const rows = useFieldArray({ control: form.control, name: "categories" });

  const discordCategories: SelectOption[] = [{ value: "", label: t("general") }, ...(channels ?? []).filter((c) => c.kind === "category").map((c) => ({ value: c.id, label: c.name }))];
  for (const c of initial) if (c.discordCategoryId && !discordCategories.some((o) => o.value === c.discordCategoryId)) discordCategories.push({ value: c.discordCategoryId, label: c.discordCategoryId });
  const roleItems = roles && roles.map((r) => ({ id: r.id, label: r.name }));

  const save = form.handleSubmit((values) => {
    const checked = ticketCategoriesSchema.safeParse(values.categories);
    if (!checked.success) return void toast.error(te(checked.error.issues.some((i) => i.message === "duplicate") ? "duplicate" : "invalid"));
    startTransition(async () => {
      const result = await saveTicketCategoriesAction(checked.data);
      if (result.ok) {
        toast.success(t("saved"));
        form.reset({ categories: result.categories });
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  return (
    <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-5 p-5" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-fluid-lg font-bold">{t("title")}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t("intro", { max: MAX_TICKET_CATEGORIES })}</p>
      </div>
      {rows.fields.length === 0 && <p className="rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="flex flex-col gap-4">
        {rows.fields.map((field, index) => (
          <li key={field.id} className="flex flex-col gap-3 rounded-xl border p-4">
            <FieldGroup>
              <div className="flex flex-wrap gap-3">
                <Field className="min-w-[12rem] flex-1">
                  <FieldLabel htmlFor={`tc-label-${index}`}>{t("label")}</FieldLabel>
                  <Input id={`tc-label-${index}`} maxLength={80} {...form.register(`categories.${index}.label`)} />
                </Field>
                <Field className="w-36">
                  <FieldLabel htmlFor={`tc-emoji-${index}`}>{t("emoji")}</FieldLabel>
                  <Input id={`tc-emoji-${index}`} maxLength={64} autoComplete="off" placeholder="🎫" {...form.register(`categories.${index}.emoji`)} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`tc-cat-${index}`}>{t("discordCategory")}</FieldLabel>
                <FormSelect control={form.control} name={`categories.${index}.discordCategoryId`} id={`tc-cat-${index}`} options={discordCategories} placeholder={t("general")} disabled={channels === null} />
                <FieldDescription>{t("discordCategoryHelp")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`tc-staff-${index}`}>{t("staff", { max: MAX_STAFF_ROLES })}</FieldLabel>
                <Controller
                  control={form.control}
                  name={`categories.${index}.staffRoleIds`}
                  render={({ field: f }) => (
                    <MultiPicker
                      id={`tc-staff-${index}`}
                      value={f.value}
                      onChange={f.onChange}
                      items={roleItems}
                      max={MAX_STAFF_ROLES}
                      labels={{ selected: t("staffSelected"), none: t("staffNone"), search: t("staffSearch"), noMatch: t("noMatch"), full: t("staffFull", { max: MAX_STAFF_ROLES }), offline: t("offline"), remove: (name: string) => t("removeRole", { name }) }}
                    />
                  )}
                />
                <FieldDescription>{t("staffHelp")}</FieldDescription>
              </Field>
            </FieldGroup>
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={() => rows.remove(index)}>
                <Trash2 aria-hidden />
                {t("remove")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {errors.categories && <FieldError>{te("invalid")}</FieldError>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={rows.fields.length >= MAX_TICKET_CATEGORIES} onClick={() => rows.append({ label: "", emoji: "", discordCategoryId: "", staffRoleIds: [] })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
        <Button type="submit" disabled={pending || !isDirty}>
          {pending ? t("saving") : t("save")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("repost")}</p>
      </div>
    </form>
  );
}
