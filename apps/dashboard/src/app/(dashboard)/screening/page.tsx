import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getScreeningPage } from "@/modules/screening";
import { ScreeningManager } from "@/modules/screening/components/screening-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Screening"))("title") };
}

export default async function ScreeningPage() {
  // All staff can decide; only admins see the settings (the actions enforce it too).
  const session = await requireStaffPage("/screening");
  const t = await getTranslations("Screening");
  const { settings, entries, channels, roles } = await getScreeningPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <ScreeningManager initial={settings} entries={entries} channels={channels} roles={roles} canEdit={isAdmin(session.user.role)} />
    </>
  );
}
