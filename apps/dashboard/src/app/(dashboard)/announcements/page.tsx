import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getAnnouncementsPage } from "@/modules/announcements";
import { AnnouncementsManager } from "@/modules/announcements/components/announcements-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Announcements"))("title") };
}

export default async function AnnouncementsPage() {
  // Moderators and admins may use announcements; every action re-checks the session.
  const session = await requireStaffPage("/announcements");
  const t = await getTranslations("Announcements");
  const { announcements, channels, roles, templates } = await getAnnouncementsPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <AnnouncementsManager announcements={announcements} channels={channels} roles={roles} templates={templates} canPingEveryone={isAdmin(session.user.role)} />
    </>
  );
}
