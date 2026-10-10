import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getModulesPage } from "@/modules/modules";
import { ModulesManager } from "@/modules/modules/components/modules-manager";

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
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <ModulesManager modules={modules} />
    </>
  );
}
