import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getWelcomePage } from "@/modules/welcome";
import { WelcomeManager } from "@/modules/welcome/components/welcome-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Welcome"))("title") };
}

export default async function WelcomePage() {
  const session = await requireStaffPage("/welcome");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Welcome");
  const { settings, channels, roles, cardImage } = await getWelcomePage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <WelcomeManager initial={settings} channels={channels} roles={roles} cardImage={cardImage} />
    </>
  );
}
