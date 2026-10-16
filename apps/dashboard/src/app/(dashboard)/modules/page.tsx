import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getModulesPage } from "@/modules/modules";
import { ModulesManager } from "@/modules/modules/components/modules-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Modules"))("title") };
}

export default async function ModulesPage() {
  const session = await requireStaffPage("/modules");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Modules");
  const { modules } = await getModulesPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <ModulesManager modules={modules} />
    </>
  );
}
