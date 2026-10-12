import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getScreeningPage } from "@/modules/screening";
import { ScreeningManager } from "@/modules/screening/components/screening-manager";

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
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <ScreeningManager initial={settings} entries={entries} channels={channels} roles={roles} canEdit={isAdmin(session.user.role)} />
    </>
  );
}
