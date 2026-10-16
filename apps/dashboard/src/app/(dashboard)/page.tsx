import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Megaphone, ScrollText, Ticket, UserSearch, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaffPage } from "@/modules/auth";
import { BotStatusCard } from "@/modules/bot-status";
import { OverviewStats } from "@/modules/moderation/components/overview-stats";
import { AttentionPanel } from "@/modules/overview";

export async function generateMetadata() {
  return { title: (await getTranslations("Overview"))("title") };
}

const QUICK: Array<{ href: string; icon: LucideIcon; key: "member" | "cases" | "announcement" | "tickets" }> = [
  { href: "/members", icon: UserSearch, key: "member" },
  { href: "/cases", icon: ScrollText, key: "cases" },
  { href: "/announcements", icon: Megaphone, key: "announcement" },
  { href: "/tickets", icon: Ticket, key: "tickets" },
];

export default async function OverviewPage() {
  const session = await requireStaffPage("/");
  const t = await getTranslations("Overview");

  return (
    <>
      <PageHeader eyebrow={t("welcome", { name: session.user.name })} title={t("title")} description={t("intro")} />

      {/* The things staff open most, one click away. */}
      <nav aria-label={t("quick.title")}>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK.map(({ href, icon: Icon, key }) => (
            <li key={key}>
              <Link href={href} className="surface surface-interactive flex h-full items-center gap-3 p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-brand-text" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{t(`quick.${key}.title`)}</span>
                  <span className="truncate text-xs text-muted-foreground">{t(`quick.${key}.hint`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Each block loads on its own: a slow query must not hold up the rest. */}
      <Suspense fallback={<Skeleton className="h-[8rem] rounded-2xl" aria-hidden />}>
        <AttentionPanel />
      </Suspense>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewStats aside={<BotStatusCard />} />
      </Suspense>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-fluid" aria-hidden>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[6rem] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-fluid xl:grid-cols-3">
        <div className="flex flex-col gap-2 xl:col-span-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[4.25rem] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[12rem] rounded-2xl" />
      </div>
    </div>
  );
}
