import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getLogsPage } from "@/modules/logs";
import { LogsForm } from "@/modules/logs/components/logs-form";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Logs"))("title") };
}

export default async function LogsPage() {
  const session = await requireStaffPage("/logs");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Logs");
  const { settings, channels } = await getLogsPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <LogsForm initial={settings} channels={channels} />
    </>
  );
}
