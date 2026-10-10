import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BUILT_IN_PATTERN_COUNT, MAX_TEMP_VOICE_LOBBIES } from "@aboutselphy/shared";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getSettings } from "@/modules/tempvoice";
import { GeneralSettingsForm } from "@/modules/tempvoice/components/general-settings-form";
import { LobbiesManager } from "@/modules/tempvoice/components/lobbies-manager";
import { RoomsMonitor } from "@/modules/tempvoice/components/rooms-monitor";

export async function generateMetadata() {
  return { title: (await getTranslations("TempVoice"))("title") };
}

export default async function VoiceRoomsPage() {
  const session = await requireStaffPage("/voice-rooms");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("TempVoice");
  const { global, lobbies, channels } = await getSettings();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>

      <RoomsMonitor enabled={global.enabled} />

      <LobbiesManager lobbies={lobbies} channels={channels} maxLobbies={MAX_TEMP_VOICE_LOBBIES} />

      <section aria-labelledby="general-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="general-heading" className="text-fluid-lg font-semibold">
            {t("general.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("general.intro")}</p>
        </div>
        <GeneralSettingsForm initial={global} builtInCount={BUILT_IN_PATTERN_COUNT} maxLobbies={MAX_TEMP_VOICE_LOBBIES} />
      </section>
    </>
  );
}
