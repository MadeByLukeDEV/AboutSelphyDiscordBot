import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getRolesPage } from "@/modules/roles";
import { RolesManager } from "@/modules/roles/components/roles-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Roles"))("title") };
}

export default async function RolesPage() {
  const session = await requireStaffPage("/roles");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Roles");
  const { panels, channels, roles, emojis } = await getRolesPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <RolesManager panels={panels} channels={channels} roles={roles} emojis={emojis} />
    </>
  );
}
