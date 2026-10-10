import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { caseQueryString } from "../case-filter";
import { getOverview } from "../service";
import { CASE_STYLE } from "./case-style";
import { CasesList } from "./cases-list";

const TILES = ["warn", "timeout", "kick", "ban"] as const;

export async function OverviewStats() {
  const t = await getTranslations("Overview");
  const tm = await getTranslations("Moderation");
  const { byType, activeWarnings, recent } = await getOverview();
  const count = (type: string) => byType.find((r) => r.type === type)?.count ?? 0;
  const total = byType.reduce((n, r) => n + r.count, 0);

  return (
    <>
      <section aria-labelledby="stats-heading" className="flex flex-col gap-3">
        <h2 id="stats-heading" className="text-fluid-lg font-semibold">
          {t("last7days")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {TILES.map((type) => (
            <li key={type}>
              <Link
                href={`/cases${caseQueryString({ type })}`}
                className="flex h-full flex-col gap-1 overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className={cn("mb-1 h-1 w-8 rounded-full", CASE_STYLE[type].bar)} aria-hidden />
                <span className="text-fluid-2xl font-semibold tabular-nums">{count(type)}</span>
                <span className="text-sm text-muted-foreground">{tm(`types.${type}`)}</span>
              </Link>
            </li>
          ))}
          <li className="col-span-2 lg:col-span-1">
            <Link
              href={`/cases${caseQueryString({ type: "warn" })}`}
              className="flex h-full flex-col gap-1 rounded-xl border border-primary/40 bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="text-fluid-2xl font-semibold tabular-nums">{activeWarnings}</span>
              <span className="text-sm text-muted-foreground">{t("activeWarnings")}</span>
            </Link>
          </li>
        </ul>
        {total === 0 && <p className="text-sm text-muted-foreground">{t("noActivity")}</p>}
      </section>

      <section aria-labelledby="latest-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="latest-heading" className="text-fluid-lg font-semibold">
            {t("latest")}
          </h2>
          <Link href="/cases" className="text-sm underline-offset-4 hover:underline">
            {t("viewAll")}
          </Link>
        </div>
        {recent.length > 0 ? <CasesList rows={recent} /> : <p className="text-sm text-muted-foreground">{t("noCases")}</p>}
      </section>
    </>
  );
}
