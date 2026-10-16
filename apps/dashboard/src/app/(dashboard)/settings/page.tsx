import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getSettings } from "@/modules/moderation";
import { SettingsForm } from "@/modules/moderation/components/settings-form";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Moderation.settings"))("title") };
}

export default async function SettingsPage() {
  const session = await requireStaffPage("/settings");
  const t = await getTranslations("Moderation.settings");
  const settings = await getSettings();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />

      {/* Moderators see the values but can't change them; saveSettingsAction
          re-checks the role either way. */}
      <SettingsForm
        initial={settings.settings}
        channels={settings.channels}
        canEdit={isAdmin(session.user.role)}
      />
    </>
  );
}
