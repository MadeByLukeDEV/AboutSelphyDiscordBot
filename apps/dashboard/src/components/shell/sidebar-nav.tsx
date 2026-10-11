"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Megaphone, Mic, Tags, HandHeart, FileClock, Trophy, Ticket, Gift, Lightbulb, BarChart3, Star, Cake, AlarmClock, UserCog, Hash, Pin, Share2, Terminal, ListOrdered, ToggleRight, Webhook, Rss, MessageSquareReply, Radio, SquarePlay, ScrollText, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavGroup, NavLabel } from "./nav";

// Icons are looked up here: components can't be passed from the server as props.
export const NAV_ICONS: Record<NavLabel, LucideIcon> = {
  overview: LayoutDashboard,
  cases: ScrollText,
  settings: Settings,
  voiceRooms: Mic,
  twitch: Radio,
  youtube: SquarePlay,
  announcements: Megaphone,
  roles: Tags,
  welcome: HandHeart,
  logs: FileClock,
  levels: Trophy,
  tickets: Ticket,
  giveaways: Gift,
  suggestions: Lightbulb,
  polls: BarChart3,
  starboard: Star,
  birthdays: Cake,
  reminders: AlarmClock,
  roleManager: UserCog,
  statChannels: Hash,
  sticky: Pin,
  autoPublish: Share2,
  customCommands: Terminal,
  counting: ListOrdered,
  modules: ToggleRight,
  webhooks: Webhook,
  feeds: Rss,
  autoResponders: MessageSquareReply,
};

/** "/" matches only itself; every other item also matches its sub-pages ("/cases/12"). */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("Shell.nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="flex flex-col gap-5">
      {groups.map((group, index) => (
        <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
          {group.label && <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{t(`groups.${group.label}`)}</p>}
          {group.items.map((item) => {
            const Icon = NAV_ICONS[item.label];
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {/* The active marker: a short brand-coloured bar with a glow. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0.75rem_var(--primary)]"
                  />
                )}
                <Icon className={cn("size-[1.15rem] shrink-0", active ? "text-brand-text" : "")} aria-hidden />
                {t(`items.${item.label}`)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
