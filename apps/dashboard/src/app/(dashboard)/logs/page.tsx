import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getLogsPage } from "@/modules/logs";
import { LogsForm } from "@/modules/logs/components/logs-form";

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
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <LogsForm initial={settings} channels={channels} />
    </>
  );
}
