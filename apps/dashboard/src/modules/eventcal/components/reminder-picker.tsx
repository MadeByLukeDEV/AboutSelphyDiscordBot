"use client";

import { Check, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { MAX_LEAD_TIMES } from "@aboutselphy/shared/eventcal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** The days before the start that can be picked. */
const REMINDER_CHOICES = [14, 7, 3, 2, 1, 0] as const;

/** A clock button that opens a list of "N days before" choices (up to four), shown as a summary on the button. */
export function ReminderPicker({ id, value, onChange, invalid, emptyLabel, clearLabel }: { id: string; value: number[]; onChange: (next: number[]) => void; invalid: boolean; /** Shown on the button while nothing is picked. */ emptyLabel: string; /** The button that clears the choice. */ clearLabel: string }) {
  const t = useTranslations("Events.games");
  const label = (d: number) => (d === 0 ? t("reminderOnDay") : t("reminderDaysBefore", { count: d }));
  const sorted = [...value].sort((a, b) => b - a);
  const full = value.length >= MAX_LEAD_TIMES;

  function toggle(day: number) {
    if (value.includes(day)) onChange(value.filter((d) => d !== day));
    else if (!full) onChange([...value, day].sort((a, b) => b - a));
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button id={id} type="button" variant="outline" aria-invalid={invalid || undefined} className="h-auto min-h-9 w-full justify-start gap-2 py-2 text-left font-normal" />}>
        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {sorted.length === 0 ? <span className="text-muted-foreground">{emptyLabel}</span> : <span className="flex flex-wrap gap-x-2 gap-y-1">{sorted.map((d) => <Badge key={d} variant="secondary">{label(d)}</Badge>)}</span>}
      </PopoverTrigger>
      <PopoverContent className="flex w-[18rem] flex-col gap-1 p-2" align="start">
        <p className="px-2 py-1 text-xs text-muted-foreground">{t("reminderLimit", { max: MAX_LEAD_TIMES })}</p>
        {REMINDER_CHOICES.map((d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={!on && full}
              onClick={() => toggle(d)}
              className={cn("flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", on && "bg-primary/10 font-semibold")}
            >
              {label(d)}
              {on && <Check className="size-4 text-primary" aria-hidden />}
            </button>
          );
        })}
        {value.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="mt-1 justify-start" onClick={() => onChange([])}>
            {clearLabel}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
