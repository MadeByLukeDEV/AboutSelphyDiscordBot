"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { MAX_ACT_REASON } from "@aboutselphy/shared/moderation-act";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { editCaseReasonAction } from "../actions";

/** Correct the reason of a case. The case then shows who changed it and when, and the log message is refreshed. */
export function EditReasonButton({ caseNumber, reason }: { caseNumber: number; reason: string }) {
  const t = useTranslations("Moderation.editReason");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(reason);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await editCaseReasonAction(caseNumber, text);
      if (result.ok) {
        toast.success(result.logUpdated ? t("done") : t("doneNoLog"));
        setOpen(false);
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setText(reason);
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" className="-ml-2" />}>
        <Pencil aria-hidden />
        {t("button")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { number: caseNumber })}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="edit-reason">{t("label")}</FieldLabel>
            <Textarea id="edit-reason" rows={4} maxLength={MAX_ACT_REASON} value={text} onChange={(e) => setText(e.target.value)} />
            <FieldDescription>{t("help")}</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
          <Button onClick={save} disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
