import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Ban, Clock, DoorOpen, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { caseQueryString } from "../case-filter";
import { getOverview } from "../service";
import { CASE_STYLE } from "./case-style";
import { CasesList } from "./cases-list";

const TILES = ["warn", "timeout", "kick", "ban"] as const;

const TILE_ICONS: Record<(typeof TILES)[number], LucideIcon> = { warn: TriangleAlert, timeout: Clock, kick: DoorOpen, ban: Ban };

function Chip({ type }: { type: (typeof TILES)[number] }) {
  const Icon = TILE_ICONS[type];
  return (
    <span className={cn("flex size-10 items-center justify-center rounded-xl", CASE_STYLE[type].badge)} aria-hidden>
      <Icon className="size-5" />
    </span>
  );
}

export async function OverviewStats() {
  const t = await getTranslations("Overview");
  const tm = await getTranslations("Moderation");
  const { byType, activeWarnings, recent, moderators } = await getOverview();
  const busiest = Math.max(1, ...moderators.map((m) => m.count));
  const count = (type: string) => byType.find((r) => r.type === type)?.count ?? 0;
  const total = byType.reduce((n, r) => n + r.count, 0);

  return (
    <>
      <section aria-labelledby="stats-heading" className="flex flex-col gap-3">
        <h2 id="stats-heading" className="text-fluid-lg font-bold">
          {t("last7days")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {TILES.map((type) => (
            <li key={type}>
              <Link
                href={`/cases${caseQueryString({ type })}`}
                className="surface surface-interactive flex h-full flex-col gap-3 p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Chip type={type} />
                <span className="flex flex-col">
                  <span className="text-fluid-2xl font-bold tabular-nums">{count(type)}</span>
                  <span className="text-sm text-muted-foreground">{tm(`types.${type}`)}</span>
                </span>
              </Link>
            </li>
          ))}
          <li className="col-span-2 lg:col-span-1">
            <Link
              href={`/cases${caseQueryString({ type: "warn" })}`}
              className="surface surface-interactive flex h-full flex-col gap-3 p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-brand-text" aria-hidden>
                <ShieldAlert className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-fluid-2xl font-bold tabular-nums">{activeWarnings}</span>
                <span className="text-sm text-muted-foreground">{t("activeWarnings")}</span>
              </span>
            </Link>
          </li>
        </ul>
        {total === 0 && <p className="text-sm text-muted-foreground">{t("noActivity")}</p>}
      </section>

      <section aria-labelledby="mods-heading" className="flex flex-col gap-3">
        <h2 id="mods-heading" className="text-fluid-lg font-bold">
          {t("moderators.title")}
        </h2>
        {moderators.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("moderators.none")}</p>
        ) : (
          <ul className="surface flex flex-col gap-3 p-4">
            {moderators.map((m) => (
              <li key={m.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{m.automatic ? t("moderators.automatic") : (m.name ?? m.key)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{t("moderators.cases", { count: m.count })}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (m.count / busiest) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="latest-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="latest-heading" className="text-fluid-lg font-bold">
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
