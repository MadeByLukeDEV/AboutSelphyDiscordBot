import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getLevelsPage } from "@/modules/levels";
import { LevelsManager } from "@/modules/levels/components/levels-manager";
import { XpImport } from "@/modules/levels/components/xp-import";

export async function generateMetadata() {
  return { title: (await getTranslations("Levels"))("title") };
}

export default async function LevelsPage() {
  const session = await requireStaffPage("/levels");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Levels");
  const { settings, leaderboard, total, channels, roles } = await getLevelsPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <LevelsManager initial={settings} leaderboard={leaderboard} total={total} channels={channels} roles={roles} />
      <XpImport />
    </>
  );
}
