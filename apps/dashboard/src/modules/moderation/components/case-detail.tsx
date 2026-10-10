import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ModCase } from "@aboutselphy/db";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { caseQueryString } from "../case-filter";
import { CASE_STYLE } from "./case-style";
import { CaseTypeBadge } from "./case-type-badge";
import { CasesList } from "./cases-list";
import { PardonButton } from "./pardon-button";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const parts: string[] = [];
  let rest = seconds;
  for (const [unit, size] of [["w", 604_800], ["d", 86_400], ["h", 3600], ["m", 60]] as const) {
    const n = Math.floor(rest / size);
    if (n > 0) parts.push(`${n}${unit}`);
    rest -= n * size;
  }
  return parts.join(" ") || `${seconds}s`;
}

export async function CaseDetail({ row, others }: { row: ModCase; others: ModCase[] }) {
  const t = await getTranslations("Moderation");
  const format = await getFormatter();
  const when = (date: Date) => format.dateTime(date, { dateStyle: "long", timeStyle: "short" });
  const canPardon = row.type === "warn" && row.active;

  return (
    <div className="flex flex-col gap-fluid">
      <header className="flex flex-col gap-3">
        <Link href="/cases" className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("detail.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("h-8 w-1.5 rounded-full", CASE_STYLE[row.type].bar)} aria-hidden />
          <h1 className="text-fluid-2xl font-semibold tracking-tight tabular-nums">
            {t("detail.title", { number: row.caseNumber })}
          </h1>
          <CaseTypeBadge type={row.type} label={t(`types.${row.type}`)} />
          {canPardon && (
            <div className="ml-auto">
              <PardonButton caseNumber={row.caseNumber} />
            </div>
          )}
        </div>
      </header>

      <dl className="divide-y rounded-xl border bg-card px-4">
        <Row label={t("detail.member")}>
          <p className="font-medium">{row.targetName ?? row.targetId}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{row.targetId}</p>
        </Row>
        <Row label={t("detail.moderator")}>
          {row.moderatorId === "system" ? (
            t("automatic")
          ) : (
            <>
              <p className="font-medium">{row.moderatorName ?? row.moderatorId}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{row.moderatorId}</p>
            </>
          )}
        </Row>
        <Row label={t("detail.reason")}>
          {/* Rendered as text by React: staff- and Discord-supplied text is never HTML. */}
          <p className="whitespace-pre-wrap">{row.reason ?? t("noReason")}</p>
        </Row>
        {row.durationSeconds ? <Row label={t("detail.duration")}>{formatDuration(row.durationSeconds)}</Row> : null}
        {row.expiresAt ? <Row label={t("detail.until")}>{when(row.expiresAt)}</Row> : null}
        <Row label={t("detail.created")}>{when(row.createdAt)}</Row>
        <Row label={t("detail.source")}>{t(`detail.sources.${row.source}`)}</Row>
        {row.type === "warn" && (
          <Row label={t("detail.status")}>
            {row.active
              ? t("detail.active")
              : row.pardonedAt
                ? row.pardonedByName
                  ? t("detail.pardoned", { name: row.pardonedByName, date: when(row.pardonedAt) })
                  : t("detail.pardonedUnknown", { date: when(row.pardonedAt) })
                : t("pardonedTag")}
          </Row>
        )}
      </dl>

      <section aria-labelledby="more-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="more-heading" className="text-fluid-lg font-semibold">
            {t("detail.more")}
          </h2>
          <Link
            href={`/cases${caseQueryString({ q: row.targetId })}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("detail.searchMember")}
          </Link>
        </div>
        {others.length > 0 ? (
          <CasesList rows={others} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("detail.moreNone")}</p>
        )}
      </section>
    </div>
  );
}
