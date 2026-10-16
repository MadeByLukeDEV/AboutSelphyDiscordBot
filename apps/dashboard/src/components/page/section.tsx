import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A titled block of a page: one card with a heading, an optional line of help and optional actions in the corner.
 * Pages are built from a few of these instead of one long wall of fields; `tone="plain"` drops the card for lists that carry their own.
 */
export function Section({ title, description, actions, children, tone = "card", className }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; tone?: "card" | "plain"; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={cn("flex flex-col gap-4", tone === "card" && "surface p-5", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {title && (
              <h2 id={id} className="text-fluid-lg font-bold">
                {title}
              </h2>
            )}
            {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
