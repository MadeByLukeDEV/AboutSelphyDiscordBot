import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getRetentionPage } from "@/modules/retention";
import { EraseMember } from "@/modules/retention/components/erase-member";
import { RetentionManager } from "@/modules/retention/components/retention-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Retention"))("title") };
}

export default async function RetentionPage() {
  const session = await requireStaffPage("/retention");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Retention");
  const { settings, last } = await getRetentionPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <RetentionManager initial={settings} last={last} />
      <EraseMember />
    </>
  );
}
