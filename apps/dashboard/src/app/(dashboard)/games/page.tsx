import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page/page-header";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getGamesPage } from "@/modules/games";
import { GamesManager } from "@/modules/games/components/games-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Games"))("title") };
}

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const session = await requireStaffPage("/games");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Games");
  const { settings, channels, top } = await getGamesPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <GamesManager initial={settings} channels={channels} top={top} initialTab={tab} />
    </>
  );
}
