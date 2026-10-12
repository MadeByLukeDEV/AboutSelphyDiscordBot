import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getRaidPage } from "@/modules/raid";
import { RaidManager } from "@/modules/raid/components/raid-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Raid"))("title") };
}

export default async function RaidPage() {
  const session = await requireStaffPage("/raid");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Raid");
  const { settings, state } = await getRaidPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <RaidManager initial={settings} state={state} />
    </>
  );
}
