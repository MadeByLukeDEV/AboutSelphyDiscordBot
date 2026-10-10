import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getYoutubePage } from "@/modules/youtube";
import { YoutubeManager } from "@/modules/youtube/components/youtube-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Youtube"))("title") };
}

export default async function YoutubePage() {
  const session = await requireStaffPage("/youtube");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Youtube");
  const { overview, channels, roles } = await getYoutubePage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <YoutubeManager overview={overview} channels={channels} roles={roles} />
    </>
  );
}
