import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { getAnnouncementsPage } from "@/modules/announcements";
import { AnnouncementsManager } from "@/modules/announcements/components/announcements-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Announcements"))("title") };
}

export default async function AnnouncementsPage() {
  // Moderators and admins may use announcements; every action re-checks the session.
  await requireStaffPage("/announcements");
  const t = await getTranslations("Announcements");
  const { announcements, channels, roles } = await getAnnouncementsPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <AnnouncementsManager announcements={announcements} channels={channels} roles={roles} />
    </>
  );
}
