import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page/page-header";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getMemberOverviewPage } from "@/modules/memberoverview";
import { MemberOverviewManager } from "@/modules/memberoverview/components/member-overview-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("MemberOverview"))("title") };
}

export default async function MemberOverviewPage() {
  const session = await requireStaffPage("/member-overview");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("MemberOverview");
  const { channels, ...data } = await getMemberOverviewPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <MemberOverviewManager data={data} channels={channels} />
    </>
  );
}
