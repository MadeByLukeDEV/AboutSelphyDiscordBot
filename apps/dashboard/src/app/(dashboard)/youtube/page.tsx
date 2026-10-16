import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getYoutubePage } from "@/modules/youtube";
import { YoutubeManager } from "@/modules/youtube/components/youtube-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Youtube"))("title") };
}

export default async function YoutubePage() {
  const session = await requireStaffPage("/youtube");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Youtube");
  const { overview, channels, roles } = await getYoutubePage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <YoutubeManager overview={overview} channels={channels} roles={roles} />
    </>
  );
}
