import { cn } from "@/lib/utils";
import type { CASE_TYPES } from "../schema";
import { CASE_STYLE } from "./case-style";

/** The label is passed in so this works in both server and client components. */
export function CaseTypeBadge({
  type,
  label,
  className,
}: {
  type: (typeof CASE_TYPES)[number];
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        CASE_STYLE[type].badge,
        className,
      )}
    >
      {label}
    </span>
  );
}
