"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { MAX_IMPORT_CHARS, MAX_IMPORT_ROWS } from "@aboutselphy/shared/levels-import";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { importXpAction } from "../actions";

/** Paste another bot's XP totals (MEE6 leaderboard JSON, or lines of "id xp name"). Never lowers anyone's XP. */
export function XpImport() {
  const t = useTranslations("Levels.import");
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await importXpAction({ text });
      if (result.ok) {
        toast.success(t("done", { created: result.created, raised: result.raised, unchanged: result.unchanged, skipped: result.skipped }));
        setText("");
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  return (
    <section className="surface flex flex-col gap-4 p-5" aria-labelledby="lv-import-title">
      <div className="flex flex-col gap-1">
        <h2 id="lv-import-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t("intro", { max: MAX_IMPORT_ROWS })}</p>
      </div>
      <Field>
        <FieldLabel htmlFor="lv-import-text">{t("label")}</FieldLabel>
        <Textarea id="lv-import-text" rows={6} maxLength={MAX_IMPORT_CHARS} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={'{"players":[{"id":"123456789012345678","username":"Name","xp":1500}]}'} />
        <FieldDescription>{t("help")}</FieldDescription>
      </Field>
      <div>
        <Button type="button" disabled={pending || text.trim() === ""} onClick={run}>
          <Upload aria-hidden />
          {pending ? t("importing") : t("button")}
        </Button>
      </div>
    </section>
  );
}
