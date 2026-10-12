"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { announcementTemplateInput, MAX_TEMPLATE_NAME } from "@aboutselphy/shared/announcement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAnnouncementTemplateAction, saveAnnouncementTemplateAction } from "../actions";
import type { TemplateView } from "../schema";

export type TemplateDraft = Omit<TemplateView, "id" | "name">;

/** Start from a saved template, or save what is in the form as a new one. */
export function TemplateBar({ templates, draft, onApply }: { templates: TemplateView[]; draft: () => TemplateDraft; onApply: (template: TemplateView) => void }) {
  const t = useTranslations("Announcements.templates");
  const te = useTranslations("Announcements.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function save() {
    const checked = announcementTemplateInput.safeParse({ ...draft(), name });
    if (!checked.success) {
      const first = checked.error.issues[0]?.message;
      return void toast.error(first === "empty" ? t("needsContent") : first === "image" ? te("field.image") : t("needsName"));
    }
    startTransition(async () => {
      const result = await saveAnnouncementTemplateAction(checked.data);
      if (result.ok) {
        toast.success(t("saved"));
        setName("");
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAnnouncementTemplateAction({ id });
      if (result.ok) router.refresh();
      else toast.error(te(result.error));
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("title")}</p>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex items-center rounded-full border">
                <Button type="button" variant="ghost" size="sm" className="rounded-full" disabled={pending} onClick={() => onApply(tpl)}>
                  {tpl.name}
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" aria-label={t("remove", { name: tpl.name })} disabled={pending} onClick={() => remove(tpl.id)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={t("nameLabel")} placeholder={t("namePlaceholder")} maxLength={MAX_TEMPLATE_NAME} className="max-w-[16rem]" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="button" variant="outline" size="sm" disabled={pending || name.trim() === ""} onClick={save}>
          <Save aria-hidden />
          {t("save")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("help")}</p>
    </div>
  );
}
