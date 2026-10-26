import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getFeedsPage } from "@/modules/feeds";
import { FeedsManager } from "@/modules/feeds/components/feeds-manager";
import { getProductWatchPage } from "@/modules/productwatch";
import { ProductWatchManager } from "@/modules/productwatch/components/product-watch-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Feeds"))("title") };
}

export default async function FeedsPage() {
  const session = await requireStaffPage("/feeds");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Feeds");
  const { feeds, channels, roles, ready } = await getFeedsPage();
  const { watches } = await getProductWatchPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <FeedsManager feeds={feeds} channels={channels} roles={roles} ready={ready} />
      <ProductWatchManager watches={watches} channels={channels} roles={roles} />
    </>
  );
}
