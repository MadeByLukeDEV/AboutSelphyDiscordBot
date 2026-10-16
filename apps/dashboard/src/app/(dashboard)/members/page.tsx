import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { MemberLookup } from "@/modules/moderation/components/member-lookup";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Members"))("title") };
}

export default async function MembersPage() {
  // Moderators and admins; every action re-checks the session.
  await requireStaffPage("/members");
  const t = await getTranslations("Members");

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <MemberLookup />
    </>
  );
}
