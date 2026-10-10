import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getSettings } from "@/modules/moderation";
import { SettingsForm } from "@/modules/moderation/components/settings-form";

export async function generateMetadata() {
  return { title: (await getTranslations("Moderation.settings"))("title") };
}

export default async function SettingsPage() {
  const session = await requireStaffPage("/settings");
  const t = await getTranslations("Moderation.settings");
  const settings = await getSettings();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>

      {/* Moderators see the values but can't change them; saveSettingsAction
          re-checks the role either way. */}
      <SettingsForm
        initial={{ logChannelId: settings.logChannelId, dmOnAction: settings.dmOnAction }}
        channels={settings.channels}
        canEdit={isAdmin(session.user.role)}
      />
    </>
  );
}
