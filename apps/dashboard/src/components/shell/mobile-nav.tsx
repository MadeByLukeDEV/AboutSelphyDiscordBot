"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { NavGroup, NavLabel } from "./nav";
import { isActive, NAV_ICONS } from "./sidebar-nav";

// The tabs always shown on a phone, in this order, when the member may see them. Everything else is in the "More" sheet.
const PRIMARY: NavLabel[] = ["overview", "cases", "tickets"];

const tabClass = (active: boolean) =>
  cn(
    "flex min-h-[3rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );

/**
 * The tab bar at the bottom of a phone: three main pages and a "More" button that opens a sheet with
 * every page, grouped and labelled (a row of 25 bare icons doesn't fit and can't be read). The page the
 * member is on lights up "More" when it isn't one of the three tabs.
 */
export function MobileNav({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("Shell.nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const all = groups.flatMap((g) => g.items);
  const primary = PRIMARY.map((label) => all.find((i) => i.label === label)).filter((i): i is NonNullable<typeof i> => Boolean(i));
  const onPrimary = primary.some((i) => isActive(pathname, i.href));

  return (
    <nav aria-label={t("label")} className="surface fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-around gap-1 rounded-2xl p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden">
      {primary.map((item) => {
        const Icon = NAV_ICONS[item.label];
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
            <Icon className={cn("size-5 shrink-0", active && "text-brand-text")} aria-hidden />
            <span className="max-w-full truncate">{t(`items.${item.label}`)}</span>
          </Link>
        );
      })}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className={tabClass(!onPrimary)} aria-label={t("more")}>
          <LayoutGrid className={cn("size-5 shrink-0", !onPrimary && "text-brand-text")} aria-hidden />
          <span className="max-w-full truncate">{t("more")}</span>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>{t("moreTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("moreDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-2">
            {groups.map((group, index) => (
              <section key={group.label ?? `group-${index}`} aria-label={group.label ? t(`groups.${group.label}`) : t("label")} className="flex flex-col gap-2">
                {group.label && <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(`groups.${group.label}`)}</h3>}
                <ul className="grid grid-cols-3 gap-2">
                  {group.items.map((item) => {
                    const Icon = NAV_ICONS[item.label];
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-center text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            active ? "border-primary/40 bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          <Icon className={cn("size-5 shrink-0", active && "text-brand-text")} aria-hidden />
                          <span className="w-full break-words hyphens-auto leading-tight">{t(`items.${item.label}`)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
