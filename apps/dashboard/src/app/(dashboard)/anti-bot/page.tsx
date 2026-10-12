import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getAntiBotPage } from "@/modules/antibot";
import { AntiBotManager } from "@/modules/antibot/components/anti-bot-manager";

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
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <AntiBotManager initial={settings} stats={stats} channels={channels} />
    </>
  );
}
