import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getAntiBotPage } from "@/modules/antibot";
import { AntiBotManager } from "@/modules/antibot/components/anti-bot-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("AntiBot"))("title") };
}

export default async function AntiBotPage() {
  const session = await requireStaffPage("/anti-bot");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("AntiBot");
  const { settings, stats, channels } = await getAntiBotPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <AntiBotManager initial={settings} stats={stats} channels={channels} />
    </>
  );
}
