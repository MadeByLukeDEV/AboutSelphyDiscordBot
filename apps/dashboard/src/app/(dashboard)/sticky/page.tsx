import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MAX_STICKY } from "@aboutselphy/shared/sticky";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getStickyPage } from "@/modules/sticky";
import { StickyManager } from "@/modules/sticky/components/sticky-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Sticky"))("title") };
}

export default async function StickyPage() {
  const session = await requireStaffPage("/sticky");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Sticky");
  const { stickies, channels } = await getStickyPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <StickyManager stickies={stickies} channels={channels} max={MAX_STICKY} />
    </>
  );
}
