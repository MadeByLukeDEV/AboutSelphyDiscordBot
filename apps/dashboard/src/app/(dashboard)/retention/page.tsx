import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getRetentionPage } from "@/modules/retention";
import { RetentionManager } from "@/modules/retention/components/retention-manager";

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
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <RetentionManager initial={settings} last={last} />
    </>
  );
}
