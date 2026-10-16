import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getRoleManagerPage } from "@/modules/role-manager";
import { RoleManager } from "@/modules/role-manager/components/role-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("RoleManager"))("title") };
}

export default async function RoleManagerPage() {
  const session = await requireStaffPage("/role-manager");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("RoleManager");
  const { roles, dangling } = await getRoleManagerPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <RoleManager roles={roles} dangling={dangling} />
    </>
  );
}
