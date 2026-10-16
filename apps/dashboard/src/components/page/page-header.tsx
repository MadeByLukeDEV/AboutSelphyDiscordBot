import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * The top of every page: an optional small line above (area or greeting), the title, one sentence of help, and the page's main
 * actions on the right (they wrap under the title on a phone). One look for every page, so people always know where to look.
 */
export function PageHeader({ title, description, eyebrow, back, actions }: { title: string; description?: string; eyebrow?: string; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="text-sm font-medium text-brand-text">{eyebrow}</p>}
        <h1 className="text-fluid-2xl font-bold tracking-tight break-words">{title}</h1>
        {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
