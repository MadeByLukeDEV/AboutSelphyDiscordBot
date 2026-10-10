import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getCountingPage } from "@/modules/counting";
import { CountingManager } from "@/modules/counting/components/counting-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Counting"))("title") };
}

export default async function CountingPage() {
  const session = await requireStaffPage("/counting");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Counting");
  const { settings, stats, channels } = await getCountingPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <CountingManager initial={settings} stats={stats} channels={channels} />
    </>
  );
}
