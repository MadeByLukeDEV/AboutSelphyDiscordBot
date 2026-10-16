import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MAX_AUTO_RESPONDERS } from "@aboutselphy/shared/auto-responders";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getAutoRespondersPage } from "@/modules/auto-responders";
import { AutoRespondersManager } from "@/modules/auto-responders/components/auto-responders-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("AutoResponders"))("title") };
}

export default async function AutoRespondersPage() {
  const session = await requireStaffPage("/auto-responders");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("AutoResponders");
  const { responders, channels } = await getAutoRespondersPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <AutoRespondersManager responders={responders} channels={channels} max={MAX_AUTO_RESPONDERS} />
    </>
  );
}
