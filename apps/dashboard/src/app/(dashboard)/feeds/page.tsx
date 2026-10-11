import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getFeedsPage } from "@/modules/feeds";
import { FeedsManager } from "@/modules/feeds/components/feeds-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Feeds"))("title") };
}

export default async function FeedsPage() {
  const session = await requireStaffPage("/feeds");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Feeds");
  const { feeds, channels, roles, ready } = await getFeedsPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <FeedsManager feeds={feeds} channels={channels} roles={roles} ready={ready} />
    </>
  );
}
