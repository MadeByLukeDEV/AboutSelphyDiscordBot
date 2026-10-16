import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getCountingPage } from "@/modules/counting";
import { CountingManager } from "@/modules/counting/components/counting-manager";
import { PageHeader } from "@/components/page/page-header";

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
      <PageHeader title={t("title")} description={t("intro")} />
      <CountingManager initial={settings} stats={stats} channels={channels} />
    </>
  );
}
