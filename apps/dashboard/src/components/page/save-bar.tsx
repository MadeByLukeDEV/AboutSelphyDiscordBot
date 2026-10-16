"use client";

import { Button } from "@/components/ui/button";

/**
 * The one place to save a settings page: it stays at the bottom of the screen while there are unsaved changes and hides itself when
 * there are none, so nobody scrolls looking for a button or leaves a tab with changes pending. On a phone it sits above the tab bar.
 */
export function SaveBar({ dirty, pending, onSave, onDiscard, label, savingLabel, dirtyLabel, discardLabel }: { dirty: boolean; pending: boolean; onSave: () => void; onDiscard?: () => void; label: string; savingLabel: string; dirtyLabel: string; discardLabel?: string }) {
  if (!dirty && !pending) return null;
  return (
    <div role="status" className="surface sticky bottom-24 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-lg lg:bottom-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className="size-2 rounded-full bg-amber-500" />
        {dirtyLabel}
      </p>
      <div className="flex items-center gap-2">
        {onDiscard && discardLabel && (
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={pending}>
            {discardLabel}
          </Button>
        )}
        <Button type="button" size="sm" onClick={onSave} disabled={pending}>
          {pending ? savingLabel : label}
        </Button>
      </div>
    </div>
  );
}
