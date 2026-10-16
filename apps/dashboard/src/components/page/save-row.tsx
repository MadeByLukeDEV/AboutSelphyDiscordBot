"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The end of a plain settings form: a submit button that stays in view at the bottom of the screen while the form has unsaved changes,
 * so a long form never needs a scroll to the bottom to save. When nothing changed it is a quiet, disabled button in place.
 */
export function SaveRow({ dirty, pending, label, savingLabel }: { dirty: boolean; pending: boolean; label: string; savingLabel: string }) {
  const t = useTranslations("Shell.save");
  const active = dirty || pending;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", active && "surface sticky bottom-24 z-20 px-4 py-3 shadow-lg lg:bottom-4")}>
      {active ? (
        <p role="status" className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-2 rounded-full bg-amber-500" />
          {t("unsaved")}
        </p>
      ) : (
        <span />
      )}
      <Button type="submit" size={active ? "sm" : "default"} disabled={pending || !dirty}>
        {pending ? savingLabel : label}
      </Button>
    </div>
  );
}
