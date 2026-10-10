import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getStarboardPage } from "@/modules/starboard";
import { StarboardManager } from "@/modules/starboard/components/starboard-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Starboard"))("title") };
}

export default async function StarboardPage() {
  const session = await requireStaffPage("/starboard");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Starboard");
  const { settings, posts, channels } = await getStarboardPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <StarboardManager initial={settings} posts={posts} channels={channels} />
    </>
  );
}
