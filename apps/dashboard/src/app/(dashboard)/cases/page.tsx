import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { caseQueryString, caseQuerySchema, getCasesPage } from "@/modules/moderation";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CasesFilter } from "@/modules/moderation/components/cases-filter";
import { CasesList } from "@/modules/moderation/components/cases-list";
import { Pagination } from "@/modules/moderation/components/pagination";

export async function generateMetadata() {
  return { title: (await getTranslations("Moderation"))("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CasesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage("/cases");
  const t = await getTranslations("Moderation");

  // The query comes from the address bar: invalid values fall back to defaults.
  const raw = await searchParams;
  const query = caseQuerySchema.parse({ type: first(raw.type), q: first(raw.q), page: first(raw.page) });
  const { rows, total, pageCount } = await getCasesPage(query);

  // A bookmarked page past the end (cases were filtered or removed): go to the last one.
  if (total > 0 && query.page > pageCount) redirect(`/cases${caseQueryString({ ...query, page: pageCount })}`);

  const filtered = Boolean(query.type || query.q);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <CasesFilter type={query.type} q={query.q} />
        {/* A plain link: the browser downloads the file the route builds from the same filter. */}
        <a href={`/api/cases/export${caseQueryString({ type: query.type, q: query.q })}`} download className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <Download aria-hidden />
          {t("export")}
        </a>
      </div>

      {rows.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {t("count", { count: total })}
          </p>
          <CasesList rows={rows} />
          <Pagination query={query} pageCount={pageCount} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed px-6 py-12 text-center">
          <h2 className="text-fluid-lg font-semibold">{filtered ? t("noMatch.title") : t("empty.title")}</h2>
          <p className="max-w-md text-muted-foreground">{filtered ? t("noMatch.body") : t("empty.body")}</p>
        </div>
      )}
    </>
  );
}
