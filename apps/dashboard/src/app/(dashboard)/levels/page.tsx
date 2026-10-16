import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getLevelsPage } from "@/modules/levels";
import { LevelsManager } from "@/modules/levels/components/levels-manager";
import { XpImport } from "@/modules/levels/components/xp-import";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Levels"))("title") };
}

export default async function LevelsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const session = await requireStaffPage("/levels");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Levels");
  const { settings, leaderboard, total, channels, roles } = await getLevelsPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <LevelsManager initial={settings} leaderboard={leaderboard} total={total} channels={channels} roles={roles} importSlot={<XpImport />} initialTab={tab} />
    </>
  );
}
