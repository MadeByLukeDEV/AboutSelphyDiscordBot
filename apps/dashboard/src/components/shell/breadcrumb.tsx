"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import type { NavGroup } from "./nav";
import { isActive } from "./sidebar-nav";

/** "Moderation / Cases": where the current page lives. The group is a label only (it has no page of its own). */
export function Breadcrumb({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("Shell.nav");
  const pathname = usePathname();
  const hit = groups.flatMap((g) => g.items.map((item) => ({ group: g.label, item }))).find(({ item }) => isActive(pathname, item.href));
  if (!hit) return <span />;
  return (
    <nav aria-label={t("breadcrumb")} className="flex min-w-0 items-center gap-1.5 text-sm">
      {hit.group && (
        <>
          <span className="truncate text-muted-foreground">{t(`groups.${hit.group}`)}</span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </>
      )}
      <span className="truncate font-medium">{t(`items.${hit.item.label}`)}</span>
    </nav>
  );
}
