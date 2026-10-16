"use client";

import { useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { EVENT_KINDS, gameEventSchema, MAX_LEAD_TIMES } from "@aboutselphy/shared/eventcal";
import { FormDateTime } from "@/components/form/date-time-picker";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveGameEventAction } from "../actions";
import { ReminderPicker } from "./reminder-picker";
import type { EventRow, SourceRow } from "../schema";

/** "YYYY-MM-DDTHH:mm" in UTC, the value the date picker and the schema use. */
const toLocalValue = (iso: string | null): string => (iso ? iso.slice(0, 16) : "");

const MAX_ITEM_LENGTH = 80;
const MAX_ITEMS = 30;

type EventValues = { title: string; kind: string; allDay: boolean; start: string; end: string; description: string; summary: string; items: string[]; imageUrl: string; videoUrl: string; reminderDays: number[] };

/** A titled block of the form, so a long form reads as a few clear parts. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** Items as chips: type a name and press Enter (or the plus), remove one with its cross. A pasted list with commas or line breaks adds several. */
function ChipInput({ id, value, onChange }: { id: string; value: string[]; onChange: (next: string[]) => void }) {
  const t = useTranslations("Events.games");
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const names = raw.split(/[\n,]+/).map((n) => n.trim().replace(/\s+/g, " ").slice(0, MAX_ITEM_LENGTH)).filter(Boolean);
    if (names.length === 0) return;
    const seen = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const name of names) {
      if (next.length >= MAX_ITEMS) break;
      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        next.push(name);
      }
    }
    onChange(next);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // Enter adds a chip; it must not submit the form
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input id={id} value={draft} maxLength={MAX_ITEM_LENGTH * 4} autoComplete="off" placeholder={t("itemPlaceholder")} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => add(draft)} />
        <Button type="button" variant="outline" size="icon" aria-label={t("addItem")} onClick={() => add(draft)} disabled={draft.trim() === "" || value.length >= MAX_ITEMS}>
          <Plus aria-hidden />
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((item) => (
            <li key={item}>
              <Badge variant="secondary" className="h-auto gap-1 py-1 pr-1 pl-2.5 text-sm font-medium normal-case">
                {item}
                <button type="button" className="grid size-5 place-items-center rounded-full hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("removeItemChip", { name: item })} onClick={() => onChange(value.filter((v) => v !== item))}>
                  <X className="size-3.5" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Adds or edits one event of a game, in clear sections. Editing locks the event, so the bot never overwrites it again. */
export function EventForm({ source, event, onDone }: { source: SourceRow; event: EventRow | null; onDone: () => void }) {
  const t = useTranslations("Events.games");
  const te = useTranslations("Events.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<EventValues>({
    defaultValues: event
      ? { title: event.title, kind: event.kind, allDay: event.allDay, start: toLocalValue(event.startsAt), end: toLocalValue(event.endsAt), description: event.description, summary: event.summary, items: event.items, imageUrl: event.imageUrl, videoUrl: event.videoUrl, reminderDays: event.reminderDays }
      : { title: "", kind: "event", allDay: true, start: "", end: "", description: "", summary: "", items: [], imageUrl: "", videoUrl: "", reminderDays: [] },
  });
  const { errors } = form.formState;
  const kindOptions: SelectOption[] = EVENT_KINDS.map((k) => ({ value: k, label: t(`kind.${k}` as never) }));

  const submit = form.handleSubmit((values) => {
    const checked = gameEventSchema.safeParse({ ...(event ? { id: event.id } : {}), sourceId: source.id, ...values });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const k = issue.path[0];
        if (k === "title" || k === "start" || k === "end" || k === "imageUrl" || k === "videoUrl" || k === "reminderDays") form.setError(k, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveGameEventAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("eventSaved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
      <FieldGroup className="gap-4">
        <Section title={t("sectionBasics")}>
          <Field data-invalid={Boolean(errors.title) || undefined}>
            <FieldLabel htmlFor="ge-title">{t("eventTitle")}</FieldLabel>
            <Input id="ge-title" maxLength={120} aria-invalid={Boolean(errors.title) || undefined} {...form.register("title")} />
            {errors.title && <FieldError>{te("needsName")}</FieldError>}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ge-kind">{t("eventKind")}</FieldLabel>
              <FormSelect control={form.control} name="kind" id="ge-kind" options={kindOptions} placeholder={t("kind.event")} />
            </Field>
            <Field orientation="horizontal" className="items-end sm:pb-2">
              <Controller control={form.control} name="allDay" render={({ field }) => <Switch id="ge-allday" checked={field.value} onCheckedChange={field.onChange} />} />
              <FieldLabel htmlFor="ge-allday">{t("allDay")}</FieldLabel>
            </Field>
          </div>
        </Section>

        <Section title={t("sectionWhen")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="min-w-0" data-invalid={Boolean(errors.start) || undefined}>
              <FieldLabel htmlFor="ge-start">{t("start")}</FieldLabel>
              <FormDateTime control={form.control} name="start" id="ge-start" invalid={Boolean(errors.start)} />
              {errors.start && <FieldError>{te("badDate")}</FieldError>}
            </Field>
            <Field className="min-w-0" data-invalid={Boolean(errors.end) || undefined}>
              <FieldLabel htmlFor="ge-end">{t("end")}</FieldLabel>
              <FormDateTime control={form.control} name="end" id="ge-end" invalid={Boolean(errors.end)} />
              {errors.end && <FieldError>{te("badDate")}</FieldError>}
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t("utcHelp")}</p>
        </Section>

        <Section title={t("sectionText")}>
          <Field>
            <FieldLabel htmlFor="ge-desc">{t("description")}</FieldLabel>
            <Textarea id="ge-desc" rows={5} maxLength={4000} {...form.register("description")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ge-summary">{t("summary")}</FieldLabel>
            <Textarea id="ge-summary" rows={2} maxLength={600} {...form.register("summary")} />
            <FieldDescription>{t("summaryHelp")}</FieldDescription>
          </Field>
        </Section>

        <Section title={t("sectionRewards")}>
          <Field>
            <FieldLabel htmlFor="ge-items">{t("items")}</FieldLabel>
            <Controller control={form.control} name="items" render={({ field }) => <ChipInput id="ge-items" value={field.value} onChange={field.onChange} />} />
            <FieldDescription>{t("itemsHelp")}</FieldDescription>
          </Field>
        </Section>

        <Section title={t("sectionPictures")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="min-w-0" data-invalid={Boolean(errors.imageUrl) || undefined}>
              <FieldLabel htmlFor="ge-image">{t("imageUrl")}</FieldLabel>
              <Input id="ge-image" type="url" maxLength={500} autoComplete="off" aria-invalid={Boolean(errors.imageUrl) || undefined} {...form.register("imageUrl")} />
              {errors.imageUrl && <FieldError>{te("badImage")}</FieldError>}
            </Field>
            <Field className="min-w-0" data-invalid={Boolean(errors.videoUrl) || undefined}>
              <FieldLabel htmlFor="ge-video">{t("videoUrl")}</FieldLabel>
              <Input id="ge-video" type="url" maxLength={500} autoComplete="off" aria-invalid={Boolean(errors.videoUrl) || undefined} {...form.register("videoUrl")} />
              {errors.videoUrl && <FieldError>{te("badVideo")}</FieldError>}
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t("videoHelp")}</p>
        </Section>

        <Section title={t("sectionReminders")}>
          <Field data-invalid={Boolean(errors.reminderDays) || undefined}>
            <FieldLabel htmlFor="ge-reminders">{t("reminders")}</FieldLabel>
            <Controller control={form.control} name="reminderDays" render={({ field }) => <ReminderPicker id="ge-reminders" value={field.value} onChange={field.onChange} invalid={Boolean(errors.reminderDays)} emptyLabel={t("remindersEmpty")} clearLabel={t("reminderClear")} />} />
            <FieldDescription>{t("remindersHelp")}</FieldDescription>
            {errors.reminderDays && <FieldError>{te("badLeadDays", { max: MAX_LEAD_TIMES, limit: 60 })}</FieldError>}
          </Field>
        </Section>
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
