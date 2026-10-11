import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getRemindersPage } from "@/modules/reminders";
import { RemindersManager } from "@/modules/reminders/components/reminders-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Reminders"))("title") };
}

export default async function RemindersPage() {
  const session = await requireStaffPage("/reminders");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Reminders");
  const { settings, stats, cardImage, channels } = await getRemindersPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <RemindersManager initial={settings} stats={stats} cardImage={cardImage} channels={channels} />
    </>
  );
}
