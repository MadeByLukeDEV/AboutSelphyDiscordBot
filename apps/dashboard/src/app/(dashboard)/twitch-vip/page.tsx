import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getTwitchVipPage } from "@/modules/twitchvip";
import { TwitchVipManager } from "@/modules/twitchvip/components/twitch-vip-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("TwitchVip"))("title") };
}

export default async function TwitchVipPage() {
  const session = await requireStaffPage("/twitch-vip");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("TwitchVip");
  const { settings, state, links, roles } = await getTwitchVipPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <TwitchVipManager initial={settings} state={state} links={links} roles={roles} />
    </>
  );
}
