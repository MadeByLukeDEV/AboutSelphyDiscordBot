import type { LucideIcon } from "lucide-react";

/** What a list shows when there is nothing in it yet: say what it is for, and offer the one next step. */
export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-brand-text" aria-hidden>
          <Icon className="size-6" />
        </span>
      )}
      <div className="flex max-w-md flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
