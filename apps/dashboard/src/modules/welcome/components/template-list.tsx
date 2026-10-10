"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { DEFAULT_WELCOME_TEMPLATE, MAX_WELCOME_TEMPLATE, MAX_WELCOME_TEMPLATES, WELCOME_PLACEHOLDERS } from "@aboutselphy/shared/welcome";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/**
 * The welcome texts: up to 10, the bot picks one at random for each new member. Each has insert
 * buttons for the placeholders (at the cursor).
 */
export function TemplateList({ value, onChange, invalid }: { value: string[]; onChange: (next: string[]) => void; invalid: boolean }) {
  const t = useTranslations("Welcome.variants");

  function update(index: number, text: string) {
    onChange(value.map((v, i) => (i === index ? text : v)));
  }

  function insert(index: number, placeholder: string) {
    const el = document.getElementById(`w-tpl-${index}`) as HTMLTextAreaElement | null;
    const token = `{${placeholder}}`;
    const current = value[index] ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    update(index, `${current.slice(0, start)}${token}${current.slice(end)}`.slice(0, MAX_WELCOME_TEMPLATE));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("help", { max: MAX_WELCOME_TEMPLATES })}</p>
      </div>

      {value.length === 0 && <p className="rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">{t("empty")}</p>}

      <ul className="flex flex-col gap-3">
        {value.map((text, index) => (
          <li key={index} className="flex flex-col gap-2 rounded-xl border p-3">
            <Field data-invalid={(invalid && text.trim() === "") || undefined}>
              <FieldLabel htmlFor={`w-tpl-${index}`}>{t("variant", { number: index + 1 })}</FieldLabel>
              <Textarea id={`w-tpl-${index}`} rows={2} maxLength={MAX_WELCOME_TEMPLATE} value={text} onChange={(e) => update(index, e.target.value)} />
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("insert")}>
                <span className="text-xs text-muted-foreground">{t("insert")}</span>
                {WELCOME_PLACEHOLDERS.map((p) => (
                  <Button key={p} type="button" variant="outline" size="xs" onClick={() => insert(index, p)}>
                    {`{${p}}`}
                  </Button>
                ))}
              </div>
              <FieldDescription>{t("count", { count: text.length, max: MAX_WELCOME_TEMPLATE })}</FieldDescription>
            </Field>
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                <Trash2 aria-hidden />
                {t("remove")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, DEFAULT_WELCOME_TEMPLATE])} disabled={value.length >= MAX_WELCOME_TEMPLATES}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>
    </div>
  );
}
