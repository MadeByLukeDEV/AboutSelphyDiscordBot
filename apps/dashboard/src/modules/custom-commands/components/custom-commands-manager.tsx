"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { customCommandInput, MAX_COMMAND_NAME, MAX_COMMAND_RESPONSE, normalizeCommandName } from "@aboutselphy/shared/custom-commands";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { removeCustomCommandAction, saveCustomCommandAction } from "../actions";
import type { CustomCommandRow } from "../schema";

type FormValues = { name: string; response: string; ephemeral: boolean; enabled: boolean };

/** The custom commands with add, edit and remove. State flows in as props; changes call router.refresh(). */
export function CustomCommandsManager({ commands, max }: { commands: CustomCommandRow[]; max: number }) {
  const t = useTranslations("CustomCommands");
  const te = useTranslations("CustomCommands.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ row: CustomCommandRow | null } | null>(null);

  function remove(row: CustomCommandRow) {
    startTransition(async () => {
      const result = await removeCustomCommandAction(row.id);
      if (result.ok) {
        toast.success(t("removed"));
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <section aria-labelledby="cc-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cc-heading" className="text-fluid-lg font-bold">
          {t("list.title")} <span className="text-sm font-normal text-muted-foreground">{t("list.count", { count: commands.length, max })}</span>
        </h2>
        <Button size="sm" disabled={commands.length >= max} onClick={() => setEditing({ row: null })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {commands.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {commands.map((c) => (
            <li key={c.id} className="surface flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-semibold">/tag {c.name}</code>
                  <Badge variant={c.enabled ? "default" : "secondary"}>{c.enabled ? t("on") : t("off")}</Badge>
                  {c.ephemeral && <Badge variant="secondary">{t("private")}</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{c.response}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("list.meta", { uses: c.uses, name: c.createdByName })}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ row: c })}>
                  {t("edit")}
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(c)}>
                  {t("remove")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.row ? t("dialog.editTitle") : t("dialog.newTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <CommandForm
              key={editing.row?.id ?? "new"}
              row={editing.row}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CommandForm({ row, onDone }: { row: CustomCommandRow | null; onDone: () => void }) {
  const t = useTranslations("CustomCommands.form");
  const te = useTranslations("CustomCommands.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: row ? { name: row.name, response: row.response, ephemeral: row.ephemeral, enabled: row.enabled } : { name: "", response: "", ephemeral: false, enabled: true } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) => {
    const checked = customCommandInput.safeParse({ ...(row ? { id: row.id } : {}), ...values });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "name" || key === "response") form.setError(key, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveCustomCommandAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="cc-name">{t("name")}</FieldLabel>
          <Input id="cc-name" maxLength={MAX_COMMAND_NAME + 8} disabled={row !== null} aria-invalid={Boolean(errors.name) || undefined} {...form.register("name", { setValueAs: (v: string) => (row ? v : normalizeCommandName(v ?? "")) })} />
          <FieldDescription>{t("nameHelp")}</FieldDescription>
          {errors.name && <FieldError>{te("badName")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.response) || undefined}>
          <FieldLabel htmlFor="cc-response">{t("response")}</FieldLabel>
          <Textarea id="cc-response" rows={7} maxLength={MAX_COMMAND_RESPONSE} aria-invalid={Boolean(errors.response) || undefined} {...form.register("response")} />
          <FieldDescription>{t("responseHelp")}</FieldDescription>
          {errors.response && <FieldError>{te("needsResponse")}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="ephemeral" render={({ field }) => <Switch id="cc-private" checked={field.value} onCheckedChange={field.onChange} />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="cc-private">{t("private")}</FieldLabel>
            <FieldDescription>{t("privateHelp")}</FieldDescription>
          </div>
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="cc-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="cc-enabled">{t("enabled")}</FieldLabel>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
