import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MAX_STAT_CHANNELS } from "@aboutselphy/shared/stat-channels";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getStatChannelsPage } from "@/modules/stat-channels";
import { StatChannelsManager } from "@/modules/stat-channels/components/stat-channels-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("StatChannels"))("title") };
}

export default async function StatChannelsPage() {
  const session = await requireStaffPage("/stat-channels");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("StatChannels");
  const { stats, channels } = await getStatChannelsPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <StatChannelsManager stats={stats} channels={channels} max={MAX_STAT_CHANNELS} />
    </>
  );
}
