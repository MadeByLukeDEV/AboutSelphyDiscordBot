import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getAutoPublishPage } from "@/modules/auto-publish";
import { AutoPublishManager } from "@/modules/auto-publish/components/auto-publish-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("AutoPublish"))("title") };
}

export default async function AutoPublishPage() {
  const session = await requireStaffPage("/auto-publish");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("AutoPublish");
  const { chosen, channels, available } = await getAutoPublishPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <AutoPublishManager chosen={chosen} channels={channels} available={available} />
    </>
  );
}
