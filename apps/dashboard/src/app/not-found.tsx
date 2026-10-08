import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("Errors");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-gutter text-center">
      <h1 className="text-fluid-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("notFoundBody")}</p>
      <Button render={<Link href="/" />}>{t("backToOverview")}</Button>
    </main>
  );
}
