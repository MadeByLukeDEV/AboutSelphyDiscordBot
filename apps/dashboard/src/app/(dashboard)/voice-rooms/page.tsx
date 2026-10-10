import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getSettings } from "@/modules/tempvoice";
import { RoomsMonitor } from "@/modules/tempvoice/components/rooms-monitor";
import { SettingsForm } from "@/modules/tempvoice/components/settings-form";

export async function generateMetadata() {
  return { title: (await getTranslations("TempVoice"))("title") };
}

export default async function VoiceRoomsPage() {
  const session = await requireStaffPage("/voice-rooms");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("TempVoice");
  const { settings, channels } = await getSettings();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>

      <RoomsMonitor enabled={settings.enabled} />

      <section aria-labelledby="settings-heading" className="flex flex-col gap-4">
        <h2 id="settings-heading" className="text-fluid-lg font-semibold">
          {t("settings.title")}
        </h2>
        <SettingsForm initial={settings} channels={channels} />
      </section>
    </>
  );
}
