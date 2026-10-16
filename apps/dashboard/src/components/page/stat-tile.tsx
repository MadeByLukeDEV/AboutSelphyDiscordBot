import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A number with a label and an icon that links to where it comes from. `tone="attention"` marks something that needs a human. */
export function StatTile({ href, icon: Icon, value, label, tone = "default" }: { href: string; icon: LucideIcon; value: React.ReactNode; label: string; tone?: "default" | "attention" }) {
  return (
    <Link href={href} className="surface surface-interactive flex h-full items-center gap-3 p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone === "attention" ? "bg-amber-500/15 text-amber-500" : "bg-primary/15 text-brand-text")} aria-hidden>
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-fluid-xl leading-tight font-bold tabular-nums">{value}</span>
        <span className="truncate text-sm text-muted-foreground">{label}</span>
      </span>
    </Link>
  );
}
