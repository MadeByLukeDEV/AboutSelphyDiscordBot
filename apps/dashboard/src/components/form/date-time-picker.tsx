"use client";

import { useState } from "react";
import { de, enUS } from "date-fns/locale";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CalendarIcon } from "lucide-react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// A date and a time in one field, with the shadcn calendar instead of the browser's own picker. The value is
// the same text a datetime-local input would hold ("2026-10-12T18:30", the browser's time zone, "" for none),
// so forms switch over without changing how they read it.

const pad = (n: number) => String(n).padStart(2, "0");

type Parts = { date: Date; hour: number; minute: number };

function parse(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  return { date: new Date(y, mo - 1, d), hour: h, minute: mi };
}

const serialize = (date: Date, hour: number, minute: number) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}`;

const clamp = (n: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(0, Math.trunc(n))) : 0);

export function DateTimePicker({ id, value, onChange, min, invalid, placeholder }: { id: string; value: string; onChange: (value: string) => void; /** Earliest allowed value, same format; earlier days are greyed out. */ min?: string; invalid?: boolean; placeholder?: string }) {
  const t = useTranslations("DateTimePicker");
  const format = useFormatter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const parts = parse(value);
  const minParts = min ? parse(min) : null;

  const shown = parts ? format.dateTime(new Date(parts.date.getFullYear(), parts.date.getMonth(), parts.date.getDate(), parts.hour, parts.minute), { dateStyle: "medium", timeStyle: "short" }) : null;

  function pick(day: Date | undefined) {
    if (!day) return;
    // Keep the time already chosen; a first pick starts at noon, or at the earliest allowed time that day.
    onChange(serialize(day, parts?.hour ?? 12, parts?.minute ?? 0));
  }

  function setTime(hour: number, minute: number) {
    onChange(serialize(parts?.date ?? minParts?.date ?? new Date(), clamp(hour, 23), clamp(minute, 59)));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button id={id} type="button" variant="outline" aria-invalid={invalid || undefined} className={cn("w-full max-w-[16rem] justify-start font-normal", !shown && "text-muted-foreground")} />}
      >
        <CalendarIcon aria-hidden />
        {shown ?? placeholder ?? t("pick")}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={parts?.date} defaultMonth={parts?.date ?? minParts?.date} onSelect={pick} disabled={minParts ? { before: minParts.date } : undefined} locale={locale === "de" ? de : enUS} weekStartsOn={1} />
        <div className="flex flex-wrap items-center gap-2 border-t p-3">
          <span className="text-sm text-muted-foreground">{t("time")}</span>
          <Input aria-label={t("hour")} inputMode="numeric" maxLength={2} className="w-[3.5rem] text-center tabular-nums" value={parts ? pad(parts.hour) : "12"} onChange={(e) => setTime(Number(e.target.value.replace(/\D/g, "")), parts?.minute ?? 0)} onFocus={(e) => e.target.select()} />
          <span aria-hidden>:</span>
          <Input aria-label={t("minute")} inputMode="numeric" maxLength={2} className="w-[3.5rem] text-center tabular-nums" value={parts ? pad(parts.minute) : "00"} onChange={(e) => setTime(parts?.hour ?? 12, Number(e.target.value.replace(/\D/g, "")))} onFocus={(e) => e.target.select()} />
          <div className="ml-auto flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              {t("clear")}
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              {t("done")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The same picker bound to a react-hook-form field. */
export function FormDateTime<T extends FieldValues>({ control, name, id, min, invalid, placeholder }: { control: Control<T>; name: FieldPath<T>; id: string; min?: string; invalid?: boolean; placeholder?: string }) {
  return <Controller control={control} name={name} render={({ field }) => <DateTimePicker id={id} value={String(field.value ?? "")} onChange={field.onChange} min={min} invalid={invalid} placeholder={placeholder} />} />;
}
