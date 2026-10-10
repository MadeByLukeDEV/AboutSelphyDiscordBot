"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./nav";
import { isActive, NAV_ICONS } from "./sidebar-nav";

/** The tab bar at the bottom of a phone: at most four destinations, thumb-height targets. */
export function MobileNav({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("Shell.nav");
  const pathname = usePathname();
  const items = groups.flatMap((g) => g.items);

  return (
    <nav
      aria-label={t("label")}
      className="surface fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-around gap-1 rounded-2xl p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      {items.map((item) => {
        const Icon = NAV_ICONS[item.label];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[3rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className={cn("size-5 shrink-0", active && "text-brand-text")} aria-hidden />
            <span className="max-w-full truncate">{t(`items.${item.label}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
