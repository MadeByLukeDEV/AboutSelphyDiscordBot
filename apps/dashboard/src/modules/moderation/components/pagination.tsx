import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { caseQueryString } from "../case-filter";
import type { CaseQuery } from "../schema";

export async function Pagination({ query, pageCount }: { query: CaseQuery; pageCount: number }) {
  if (pageCount <= 1) return null;
  const t = await getTranslations("Moderation.pagination");
  const href = (page: number) => `/cases${caseQueryString({ ...query, page })}`;
  const link = cn(buttonVariants({ variant: "outline", size: "sm" }));

  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-3">
      {query.page > 1 ? (
        <Link href={href(query.page - 1)} className={link} rel="prev">
          <ChevronLeft aria-hidden />
          {t("previous")}
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground tabular-nums">{t("page", { page: query.page, pageCount })}</p>
      {query.page < pageCount ? (
        <Link href={href(query.page + 1)} className={link} rel="next">
          {t("next")}
          <ChevronRight aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
