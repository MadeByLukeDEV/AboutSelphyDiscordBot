import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getVerificationPage } from "@/modules/verification";
import { VerificationManager } from "@/modules/verification/components/verification-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Verification"))("title") };
}

export default async function VerificationPage() {
  const session = await requireStaffPage("/verification");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Verification");
  const { settings, panelPosted, channels, roles } = await getVerificationPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <VerificationManager initial={settings} panelPosted={panelPosted} channels={channels} roles={roles} />
    </>
  );
}
