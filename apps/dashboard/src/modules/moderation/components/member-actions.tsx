"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DASHBOARD_ACTIONS, MAX_ACT_REASON, REASON_REQUIRED, type DashboardAction } from "@aboutselphy/shared/moderation-act";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actOnMemberAction } from "../actions";

type FormValues = { type: DashboardAction; reason: string; duration: string; deleteDays: string };

/** Actions that can't be taken back with one click: they ask first. */
const CONFIRM: ReadonlySet<DashboardAction> = new Set(["kick", "ban"]);

/** Warn, time out, kick, ban, unban or note one member. The bot does it; the case names the staff member who pressed the button. */
export function MemberActions({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations("Members.act");
  const tt = useTranslations("Moderation.types");
  const te = useTranslations("Members.act.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<FormValues | null>(null);

  const form = useForm<FormValues>({ defaultValues: { type: "warn", reason: "", duration: "", deleteDays: "0" } });
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  const typeOptions: SelectOption[] = DASHBOARD_ACTIONS.map((a) => ({ value: a, label: tt(a) }));
  const dayOptions: SelectOption[] = ["0", "1", "2", "3", "4", "5", "6", "7"].map((d) => ({ value: d, label: t("deleteDaysOption", { count: Number(d) }) }));

  function run(values: FormValues) {
    startTransition(async () => {
      const result = await actOnMemberAction({ type: values.type, targetId: userId, reason: values.reason, duration: values.duration, deleteDays: Number(values.deleteDays) });
      setConfirming(null);
      if (result.ok) {
        toast.success(t("done", { number: result.caseNumber }));
        form.reset({ type: values.type, reason: "", duration: "", deleteDays: "0" });
        router.refresh();
      } else if (result.error === "refused" && result.message) {
        toast.error(result.message);
      } else {
        toast.error(te(result.error));
      }
    });
  }

  const submit = form.handleSubmit((values) => {
    // Checked here for a quick answer; the server checks everything again.
    if (REASON_REQUIRED.has(values.type) && values.reason.trim() === "") return void form.setError("reason", { type: "custom", message: "needsReason" });
    if (values.type === "timeout" && values.duration.trim() === "") return void form.setError("duration", { type: "custom", message: "badDuration" });
    if (CONFIRM.has(values.type)) return void setConfirming(values);
    run(values);
  });

  return (
    <section aria-labelledby="act-heading" className="surface flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="act-heading" className="text-fluid-lg font-bold">
          {t("title")}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="act-type">{t("type")}</FieldLabel>
            <FormSelect control={form.control} name="type" id="act-type" options={typeOptions} placeholder={t("type")} />
          </Field>
          {(type === "timeout" || type === "ban") && (
            <Field data-invalid={Boolean(errors.duration) || undefined}>
              <FieldLabel htmlFor="act-duration">{type === "timeout" ? t("duration") : t("durationBan")}</FieldLabel>
              <Input id="act-duration" placeholder="1h, 3d, 1w" maxLength={20} className="max-w-[12rem]" aria-invalid={Boolean(errors.duration) || undefined} {...form.register("duration")} />
              <FieldDescription>{type === "timeout" ? t("durationHelp") : t("durationBanHelp")}</FieldDescription>
              {errors.duration && <FieldError>{te("badDuration")}</FieldError>}
            </Field>
          )}
          {type === "ban" && (
            <Field>
              <FieldLabel htmlFor="act-delete">{t("deleteDays")}</FieldLabel>
              <FormSelect control={form.control} name="deleteDays" id="act-delete" options={dayOptions} placeholder={t("deleteDays")} />
            </Field>
          )}
          <Field data-invalid={Boolean(errors.reason) || undefined}>
            <FieldLabel htmlFor="act-reason">{REASON_REQUIRED.has(type) ? t("reasonRequired") : t("reason")}</FieldLabel>
            <Textarea id="act-reason" rows={3} maxLength={MAX_ACT_REASON} aria-invalid={Boolean(errors.reason) || undefined} {...form.register("reason")} />
            {errors.reason && <FieldError>{te("needsReason")}</FieldError>}
          </Field>
        </FieldGroup>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? t("working") : t("go")}
          </Button>
        </div>
      </form>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirming ? t("confirmTitle", { action: tt(confirming.type), name }) : ""}</DialogTitle>
            <DialogDescription>{confirming?.type === "ban" ? t("confirmBan") : t("confirmKick")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => confirming && run(confirming)}>
              {pending ? t("working") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
