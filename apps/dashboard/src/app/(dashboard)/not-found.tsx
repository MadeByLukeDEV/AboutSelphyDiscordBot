import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Inside the shell (sidebar stays), unlike the full-page app/not-found.tsx.
export default async function DashboardNotFound() {
  const t = await getTranslations("Errors");
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-fluid-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("notFoundBody")}</p>
      <Link href="/" className={cn(buttonVariants())}>
        {t("backToOverview")}
      </Link>
    </div>
  );
}
