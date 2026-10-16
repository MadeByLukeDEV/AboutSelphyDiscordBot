"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { eraseMemberBody } from "@aboutselphy/shared/retention";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { eraseMemberDataAction } from "../actions";

const CONFIRM_WORD = "ERASE";

/** Admins erase one member's data on request. A typed word guards it; the bot does the removal (cases and tickets stay). */
export function EraseMember() {
  const t = useTranslations("Retention.erase");
  const te = useTranslations("Retention.errors");
  const [pending, startTransition] = useTransition();
  const [id, setId] = useState("");
  const [typed, setTyped] = useState("");
  const valid = eraseMemberBody.safeParse({ userId: id.trim() }).success;

  function erase() {
    startTransition(async () => {
      const result = await eraseMemberDataAction({ userId: id.trim() });
      if (!result.ok) return void toast.error(result.error === "botUnavailable" ? t("eraseBotDown") : te(result.error === "forbidden" ? "forbidden" : result.error === "invalid" ? "invalid" : "failed"));
      toast.success(result.empty ? t("eraseNothing") : t("eraseDone", { summary: result.summary }));
      setId("");
      setTyped("");
    });
  }

  return (
    <section aria-labelledby="erase-heading" className="surface flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="erase-heading" className="text-fluid-lg font-bold">
          {t("eraseTitle")}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t("eraseIntro")}</p>
      </div>
      <Field>
        <FieldLabel htmlFor="erase-id">{t("eraseId")}</FieldLabel>
        <Input id="erase-id" value={id} onChange={(e) => setId(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={20} className="max-w-[18rem]" />
      </Field>
      <Field>
        <FieldLabel htmlFor="erase-confirm">{t("eraseConfirm")}</FieldLabel>
        <Input id="erase-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" maxLength={10} className="max-w-[10rem]" />
        <FieldDescription>{CONFIRM_WORD}</FieldDescription>
      </Field>
      <div>
        <Button variant="destructive" disabled={pending || !valid || typed !== CONFIRM_WORD} onClick={erase}>
          {t("eraseButton")}
        </Button>
      </div>
    </section>
  );
}
