import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getModGuidePage } from "@/modules/modguide";
import { ModGuideManager } from "@/modules/modguide/components/mod-guide-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("ModGuide"))("title") };
}

export default async function ModGuidePage() {
  const session = await requireStaffPage("/mod-guide");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("ModGuide");
  const { channels, ...data } = await getModGuidePage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <ModGuideManager data={data} channels={channels} />
    </>
  );
}
