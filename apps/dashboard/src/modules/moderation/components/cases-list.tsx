import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ModCase } from "@aboutselphy/db";
import { cn } from "@/lib/utils";
import { CASE_STYLE } from "./case-style";
import { CaseTypeBadge } from "./case-type-badge";

/**
 * The cases as a log: each row is a link to the case, with a coloured bar and
 * the case number up front. Plain rows rather than a grid of cards, because this
 * is a list people scan, newest first.
 */
export async function CasesList({ rows }: { rows: ModCase[] }) {
  const t = await getTranslations("Moderation");
  const format = await getFormatter();

  return (
    <ol className="flex flex-col gap-2">
      {rows.map((c) => (
        <li key={c.id}>
          <Link
            href={`/cases/${c.caseNumber}`}
            className="group flex items-stretch surface surface-interactive overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className={cn("w-1.5 shrink-0", CASE_STYLE[c.type].bar)} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="w-14 shrink-0 text-fluid-lg font-semibold tabular-nums">#{c.caseNumber}</span>

              <div className="flex shrink-0 items-center gap-2">
                <CaseTypeBadge type={c.type} label={t(`types.${c.type}`)} />
                {c.type === "warn" && !c.active && (
                  <span className="text-xs text-muted-foreground">{t("pardonedTag")}</span>
                )}
              </div>

              <div className="min-w-[10rem] flex-1">
                <p className="truncate font-medium">{c.targetName ?? c.targetId}</p>
                <p className="truncate text-sm text-muted-foreground">{c.reason ?? t("noReason")}</p>
              </div>

              <div className="ml-auto flex flex-col items-end text-sm text-muted-foreground">
                <span className="max-w-[10rem] truncate">
                  {c.moderatorId === "system" ? t("automatic") : (c.moderatorName ?? c.moderatorId)}
                </span>
                <time
                  dateTime={c.createdAt.toISOString()}
                  title={format.dateTime(c.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                >
                  {format.relativeTime(c.createdAt)}
                </time>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
