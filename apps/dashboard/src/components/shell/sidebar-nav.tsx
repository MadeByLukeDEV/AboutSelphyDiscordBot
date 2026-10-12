"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, ChevronDown, Crown, Hourglass, ShieldAlert, LayoutDashboard, Megaphone, Mic, Tags, HandHeart, FileClock, Trophy, Ticket, Gift, Lightbulb, BarChart3, Star, Cake, AlarmClock, UserCog, Hash, Pin, Share2, Terminal, ListOrdered, ToggleRight, Webhook, Rss, MessageSquareReply, Radio, SquarePlay, ScrollText, Settings, type LucideIcon } from "lucide-react";
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
  modGuide: BookOpen,
  antiBot: ShieldAlert,
  twitchVip: Crown,
  retention: Hourglass,
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

// Which groups the member opened or closed by hand, remembered in this browser. A group they never touched
// is open exactly when it holds the page they are on. Reading goes through useSyncExternalStore, so the
// server render and the first client render agree (no overrides yet) and storage that is blocked or full
// still works for the rest of the visit (an in-memory copy).
const STORAGE_KEY = "nav-groups";
const listeners = new Set<() => void>();
let memory = "";

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function parseOverrides(raw: string): Record<string, boolean> {
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "boolean")) : {};
  } catch {
    return {};
  }
}

/** Opens or closes one group. Merges into the freshest saved state, so two quick changes (or two tabs) never overwrite each other. */
function setGroupOpen(key: string, open: boolean): void {
  const next = { ...parseOverrides(readRaw()), [key]: open };
  memory = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, memory);
  } catch {
    // Blocked or full: the in-memory copy keeps this visit consistent.
  }
  for (const listener of listeners) listener();
}

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("Shell.nav");
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const overrides = parseOverrides(raw);

  return (
    <nav aria-label={t("label")} className="flex flex-col gap-3">
      {groups.map((group, index) => {
        const holdsActive = group.items.some((item) => isActive(pathname, item.href));
        const key = group.label ?? `group-${index}`;
        // A group without a heading (the overview) is always shown.
        const open = group.label === null ? true : (overrides[key] ?? holdsActive);
        const panelId = `nav-group-${key}`;
        return (
          <div key={key} className="flex flex-col gap-1">
            {group.label && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setGroupOpen(key, !open)}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {t(`groups.${group.label}`)}
                  {!open && holdsActive && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
                </span>
                <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 transition-transform motion-reduce:transition-none", open ? "" : "-rotate-90")} />
              </button>
            )}
            <div id={panelId} hidden={!open} className="flex flex-col gap-1">
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
                    {active && <span aria-hidden className="absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0.75rem_var(--primary)]" />}
                    <Icon className={cn("size-[1.15rem] shrink-0", active ? "text-brand-text" : "")} aria-hidden />
                    {t(`items.${item.label}`)}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
