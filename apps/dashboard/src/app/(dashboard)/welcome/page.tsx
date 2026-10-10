import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getWelcomePage } from "@/modules/welcome";
import { WelcomeManager } from "@/modules/welcome/components/welcome-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Welcome"))("title") };
}

export default async function WelcomePage() {
  const session = await requireStaffPage("/welcome");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Welcome");
  const { settings, channels, roles } = await getWelcomePage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <WelcomeManager initial={settings} channels={channels} roles={roles} />
    </>
  );
}
