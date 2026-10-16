import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getRaidPage } from "@/modules/raid";
import { RaidManager } from "@/modules/raid/components/raid-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Raid"))("title") };
}

export default async function RaidPage() {
  const session = await requireStaffPage("/raid");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Raid");
  const { settings, state } = await getRaidPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <RaidManager initial={settings} state={state} />
    </>
  );
}
