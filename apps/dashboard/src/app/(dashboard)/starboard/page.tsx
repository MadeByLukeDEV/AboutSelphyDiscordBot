import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getStarboardPage } from "@/modules/starboard";
import { StarboardManager } from "@/modules/starboard/components/starboard-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Starboard"))("title") };
}

export default async function StarboardPage() {
  const session = await requireStaffPage("/starboard");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Starboard");
  const { settings, posts, channels } = await getStarboardPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <StarboardManager initial={settings} posts={posts} channels={channels} />
    </>
  );
}
