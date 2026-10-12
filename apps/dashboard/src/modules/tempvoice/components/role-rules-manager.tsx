"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GuildRole } from "@aboutselphy/shared";
import { MAX_ROLE_RULES, type RoleRule } from "@aboutselphy/shared/tempvoice";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveRoleRulesAction } from "../actions";

type Row = { roleId: string; bitrateKbps: string; maxUserLimit: string };
type Values = { rules: Row[] };

const toRows = (rules: RoleRule[]): Row[] => rules.map((r) => ({ roleId: r.roleId, bitrateKbps: r.bitrateKbps === null ? "" : String(r.bitrateKbps), maxUserLimit: r.maxUserLimit === null ? "" : String(r.maxUserLimit) }));

/** Per-role bitrate and member-limit cap for temporary rooms. "Everyone" is the base rule. */
export function RoleRulesManager({ initial, roles }: { initial: RoleRule[]; roles: GuildRole[] | null }) {
  const t = useTranslations("TempVoice.roleRules");
  const te = useTranslations("TempVoice.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({ defaultValues: { rules: toRows(initial) } });
  const rules = useFieldArray({ control: form.control, name: "rules" });
  const { isDirty } = form.formState;

  const options: SelectOption[] = [{ value: "everyone", label: t("everyone") }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];
  for (const r of initial) if (!options.some((o) => o.value === r.roleId)) options.push({ value: r.roleId, label: r.roleId });

  const save = form.handleSubmit((values) => {
    const parsed = values.rules.map((r) => ({
      roleId: r.roleId,
      bitrateKbps: r.bitrateKbps.trim() === "" ? null : Number(r.bitrateKbps),
      maxUserLimit: r.maxUserLimit.trim() === "" ? null : Number(r.maxUserLimit),
    }));
    startTransition(async () => {
      const result = await saveRoleRulesAction(parsed);
      if (result.ok) {
        toast.success(result.botNotified ? t("saved") : t("savedBotLater"));
        form.reset({ rules: toRows(result.rules) });
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  return (
    <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-4 p-5" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      {rules.fields.length === 0 && <p className="rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="flex flex-col gap-3">
        {rules.fields.map((field, index) => (
          <li key={field.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
            <Field>
              <FieldLabel htmlFor={`tv-rule-role-${index}`}>{t("role")}</FieldLabel>
              <FormSelect control={form.control} name={`rules.${index}.roleId`} id={`tv-rule-role-${index}`} options={options} placeholder={t("role")} disabled={roles === null} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`tv-rule-bitrate-${index}`}>{t("bitrate")}</FieldLabel>
              <Input id={`tv-rule-bitrate-${index}`} type="number" inputMode="numeric" min={8} max={384} placeholder={t("default")} {...form.register(`rules.${index}.bitrateKbps`)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`tv-rule-limit-${index}`}>{t("limit")}</FieldLabel>
              <Input id={`tv-rule-limit-${index}`} type="number" inputMode="numeric" min={1} max={99} placeholder={t("noCap")} {...form.register(`rules.${index}.maxUserLimit`)} />
            </Field>
            <Button type="button" variant="ghost" size="icon" aria-label={t("remove")} onClick={() => rules.remove(index)}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <FieldDescription>{t("help")}</FieldDescription>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={rules.fields.length >= MAX_ROLE_RULES} onClick={() => rules.append({ roleId: "everyone", bitrateKbps: "", maxUserLimit: "" })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
        <Button type="submit" disabled={pending || !isDirty}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
