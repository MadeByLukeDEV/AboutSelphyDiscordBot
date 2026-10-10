import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaffPage } from "@/modules/auth";
import { BotStatusCard } from "@/modules/bot-status";
import { OverviewStats } from "@/modules/moderation/components/overview-stats";

export async function generateMetadata() {
  return { title: (await getTranslations("Overview"))("title") };
}

export default async function OverviewPage() {
  const session = await requireStaffPage("/");
  const t = await getTranslations("Overview");

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-brand-text">{t("welcome", { name: session.user.name })}</p>
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>

      {/* Cases come from the database; a slow query must not hold up the rest. */}
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewStats />
      </Suspense>

      <div className="grid gap-fluid lg:grid-cols-2">
        <BotStatusCard />
      </div>
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
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[4.25rem] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
